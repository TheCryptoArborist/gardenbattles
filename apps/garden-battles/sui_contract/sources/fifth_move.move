module battle_garden::fifth_move {
    use std::type_name::{Self, TypeName};
    use sui::bcs;
    use sui::clock::{Self, Clock};
    use sui::ed25519;
    use sui::event;
    use battle_garden::errors;

    const ATTESTATION_VERSION: u8 = 1;
    const DOMAIN: vector<u8> = b"GARDEN_BATTLES_FIFTH_MOVE_V1";
    const NETWORK: vector<u8> = b"sui:mainnet";
    const ALLOWED_FUTURE_SKEW_MS: u64 = 60_000;
    const PUBLIC_KEY_LENGTH: u64 = 32;
    const SIGNATURE_LENGTH: u64 = 64;
    // V2 direct, V2 farm, V3 and the native 30-day TREE Lock.
    const SOURCE_BITMAP_MASK: u8 = 31;
    const MAX_U64: u64 = 18446744073709551615;

    public struct FifthMoveConfig has key {
        id: UID,
        admin: address,
        enabled: bool,
        utility_coin: TypeName,
        min_underlying_tree_raw: u64,
        signer_public_key: vector<u8>,
        config_version: u64,
        max_attestation_age_ms: u64,
    }

    public struct FifthMoveAttestationPayload has copy, drop, store {
        version: u8,
        domain: vector<u8>,
        network: vector<u8>,
        fifth_move_config_id: address,
        wallet: address,
        qualified: bool,
        verified_underlying_tree_raw: u64,
        threshold_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        issued_at_ms: u64,
        expires_at_ms: u64,
    }

    public struct FifthMoveEligibility has copy, drop, store {
        entitled: bool,
        verified_underlying_tree_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        attestation_digest: vector<u8>,
    }

    public struct FifthMoveThresholdUpdated has copy, drop {
        threshold_raw: u64,
        config_version: u64,
    }

    public struct FifthMoveEnabledUpdated has copy, drop {
        enabled: bool,
        config_version: u64,
    }

    public struct FifthMoveSignerUpdated has copy, drop {
        config_version: u64,
    }

    public struct FifthMoveAttestationAgeUpdated has copy, drop {
        max_attestation_age_ms: u64,
        config_version: u64,
    }

    public struct FifthMoveAdminTransferred has copy, drop {
        old_admin: address,
        new_admin: address,
    }

    public entry fun init_fifth_move_config<T>(
        signer_public_key: vector<u8>,
        max_attestation_age_ms: u64,
        ctx: &mut TxContext,
    ) {
        assert_valid_public_key(&signer_public_key);
        assert!(max_attestation_age_ms > 0, errors::e_fifth_move_invalid_timestamp_ordering());
        let config = FifthMoveConfig {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            enabled: false,
            utility_coin: type_name::with_original_ids<T>(),
            min_underlying_tree_raw: 1_000_000_000_000,
            signer_public_key,
            config_version: 1,
            max_attestation_age_ms,
        };
        transfer::share_object(config);
    }

    fun assert_admin(config: &FifthMoveConfig, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == config.admin, errors::e_admin_only());
    }

    fun bump_version(config: &mut FifthMoveConfig) {
        assert!(config.config_version < MAX_U64, errors::e_fifth_move_version_overflow());
        config.config_version = config.config_version + 1;
    }

    fun assert_valid_public_key(signer_public_key: &vector<u8>) {
        assert!(
            vector::length(signer_public_key) == PUBLIC_KEY_LENGTH,
            errors::e_fifth_move_malformed_public_key(),
        );
    }

    public fun set_threshold(config: &mut FifthMoveConfig, threshold_raw: u64, ctx: &mut TxContext) {
        assert_admin(config, ctx);
        assert!(threshold_raw > 0, errors::e_fifth_move_threshold_mismatch());
        assert!(threshold_raw != config.min_underlying_tree_raw, errors::e_fifth_move_config_noop());
        config.min_underlying_tree_raw = threshold_raw;
        bump_version(config);
        event::emit(FifthMoveThresholdUpdated {
            threshold_raw,
            config_version: config.config_version,
        });
    }

    public fun set_enabled(config: &mut FifthMoveConfig, enabled: bool, ctx: &mut TxContext) {
        assert_admin(config, ctx);
        assert!(enabled != config.enabled, errors::e_fifth_move_config_noop());
        config.enabled = enabled;
        bump_version(config);
        event::emit(FifthMoveEnabledUpdated {
            enabled,
            config_version: config.config_version,
        });
    }

    public fun rotate_signer(config: &mut FifthMoveConfig, signer_public_key: vector<u8>, ctx: &mut TxContext) {
        assert_admin(config, ctx);
        assert_valid_public_key(&signer_public_key);
        assert!(signer_public_key != config.signer_public_key, errors::e_fifth_move_config_noop());
        config.signer_public_key = signer_public_key;
        bump_version(config);
        event::emit(FifthMoveSignerUpdated {
            config_version: config.config_version,
        });
    }

    public fun set_max_attestation_age(
        config: &mut FifthMoveConfig,
        max_attestation_age_ms: u64,
        ctx: &mut TxContext,
    ) {
        assert_admin(config, ctx);
        assert!(max_attestation_age_ms > 0, errors::e_fifth_move_invalid_timestamp_ordering());
        assert!(
            max_attestation_age_ms != config.max_attestation_age_ms,
            errors::e_fifth_move_config_noop(),
        );
        config.max_attestation_age_ms = max_attestation_age_ms;
        bump_version(config);
        event::emit(FifthMoveAttestationAgeUpdated {
            max_attestation_age_ms,
            config_version: config.config_version,
        });
    }

    public fun transfer_admin(config: &mut FifthMoveConfig, new_admin: address, ctx: &mut TxContext) {
        assert_admin(config, ctx);
        assert!(new_admin != @0x0, errors::e_invalid_address());
        assert!(new_admin != config.admin, errors::e_admin_transfer_noop());
        let old_admin = config.admin;
        config.admin = new_admin;
        event::emit(FifthMoveAdminTransferred { old_admin, new_admin });
    }

    public fun payload(
        fifth_move_config_id: address,
        wallet: address,
        qualified: bool,
        verified_underlying_tree_raw: u64,
        threshold_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        issued_at_ms: u64,
        expires_at_ms: u64,
    ): FifthMoveAttestationPayload {
        FifthMoveAttestationPayload {
            version: ATTESTATION_VERSION,
            domain: DOMAIN,
            network: NETWORK,
            fifth_move_config_id,
            wallet,
            qualified,
            verified_underlying_tree_raw,
            threshold_raw,
            source_bitmap,
            config_version,
            issued_at_ms,
            expires_at_ms,
        }
    }

    public fun payload_to_bytes(payload: &FifthMoveAttestationPayload): vector<u8> {
        bcs::to_bytes(payload)
    }

    public fun standard_eligibility(): FifthMoveEligibility {
        FifthMoveEligibility {
            entitled: false,
            verified_underlying_tree_raw: 0,
            source_bitmap: 0,
            config_version: 0,
            attestation_digest: vector::empty<u8>(),
        }
    }

    public fun snapshot_eligibility(
        entitled: bool,
        verified_underlying_tree_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        attestation_digest: vector<u8>,
    ): FifthMoveEligibility {
        FifthMoveEligibility {
            entitled,
            verified_underlying_tree_raw,
            source_bitmap,
            config_version,
            attestation_digest,
        }
    }

    public fun verify_attestation(
        config: &FifthMoveConfig,
        payload: FifthMoveAttestationPayload,
        signature: vector<u8>,
        clock: &Clock,
        ctx: &TxContext,
    ): FifthMoveEligibility {
        assert!(config.enabled, errors::e_fifth_move_disabled());
        assert_valid_public_key(&config.signer_public_key);
        assert!(
            vector::length(&signature) == SIGNATURE_LENGTH,
            errors::e_fifth_move_malformed_signature(),
        );
        assert!(payload.version == ATTESTATION_VERSION, errors::e_fifth_move_invalid_version());
        assert!(payload.domain == DOMAIN, errors::e_fifth_move_domain_mismatch());
        assert!(payload.network == NETWORK, errors::e_fifth_move_network_mismatch());
        assert!(
            payload.fifth_move_config_id == object::uid_to_address(&config.id),
            errors::e_fifth_move_wrong_config_object(),
        );
        assert!(payload.wallet == tx_context::sender(ctx), errors::e_fifth_move_wrong_wallet());
        assert!(payload.qualified, errors::e_fifth_move_not_qualified());
        assert!(
            payload.source_bitmap > 0 && payload.source_bitmap <= SOURCE_BITMAP_MASK,
            errors::e_fifth_move_invalid_source_bitmap(),
        );
        assert!(
            payload.verified_underlying_tree_raw >= config.min_underlying_tree_raw,
            errors::e_fifth_move_not_qualified(),
        );
        assert!(
            payload.threshold_raw == config.min_underlying_tree_raw,
            errors::e_fifth_move_threshold_mismatch(),
        );
        assert!(
            payload.config_version == config.config_version,
            errors::e_fifth_move_config_mismatch(),
        );

        let now = clock::timestamp_ms(clock);
        assert!(
            payload.issued_at_ms <= payload.expires_at_ms,
            errors::e_fifth_move_invalid_timestamp_ordering(),
        );
        if (payload.issued_at_ms > now) {
            assert!(
                payload.issued_at_ms - now <= ALLOWED_FUTURE_SKEW_MS,
                errors::e_fifth_move_future_issued(),
            );
        };
        assert!(now <= payload.expires_at_ms, errors::e_fifth_move_expired());
        assert!(
            payload.expires_at_ms - payload.issued_at_ms <= config.max_attestation_age_ms,
            errors::e_fifth_move_expired(),
        );

        let bytes = payload_to_bytes(&payload);
        assert!(
            ed25519::ed25519_verify(&signature, &config.signer_public_key, &bytes),
            errors::e_fifth_move_bad_signature(),
        );

        FifthMoveEligibility {
            entitled: true,
            verified_underlying_tree_raw: payload.verified_underlying_tree_raw,
            source_bitmap: payload.source_bitmap,
            config_version: payload.config_version,
            attestation_digest: bytes,
        }
    }

    public fun entitled(eligibility: &FifthMoveEligibility): bool {
        eligibility.entitled
    }

    public fun verified_underlying_tree_raw(eligibility: &FifthMoveEligibility): u64 {
        eligibility.verified_underlying_tree_raw
    }

    public fun source_bitmap(eligibility: &FifthMoveEligibility): u8 {
        eligibility.source_bitmap
    }

    public fun eligibility_config_version(eligibility: &FifthMoveEligibility): u64 {
        eligibility.config_version
    }

    public fun attestation_digest(eligibility: &FifthMoveEligibility): vector<u8> {
        utils_clone_vec_u8(&eligibility.attestation_digest)
    }

    fun utils_clone_vec_u8(values: &vector<u8>): vector<u8> {
        let mut out = vector::empty<u8>();
        let mut i = 0;
        let len = vector::length(values);
        while (i < len) {
            vector::push_back(&mut out, *vector::borrow(values, i));
            i = i + 1;
        };
        out
    }

    public fun enabled(config: &FifthMoveConfig): bool { config.enabled }
    public fun min_underlying_tree_raw(config: &FifthMoveConfig): u64 { config.min_underlying_tree_raw }
    public fun config_version(config: &FifthMoveConfig): u64 { config.config_version }
    public fun max_attestation_age_ms(config: &FifthMoveConfig): u64 { config.max_attestation_age_ms }
    public fun admin(config: &FifthMoveConfig): address { config.admin }
    public fun config_id(config: &FifthMoveConfig): address {
        object::uid_to_address(&config.id)
    }
    public fun signer_public_key(config: &FifthMoveConfig): vector<u8> {
        utils_clone_vec_u8(&config.signer_public_key)
    }
    public fun is_utility_coin<T>(config: &FifthMoveConfig): bool {
        type_name::with_original_ids<T>() == config.utility_coin
    }

    #[test_only]
    public fun new_for_testing<T>(
        signer_public_key: vector<u8>,
        max_attestation_age_ms: u64,
        ctx: &mut TxContext,
    ): FifthMoveConfig {
        assert_valid_public_key(&signer_public_key);
        assert!(max_attestation_age_ms > 0, errors::e_fifth_move_invalid_timestamp_ordering());
        FifthMoveConfig {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            enabled: false,
            utility_coin: type_name::with_original_ids<T>(),
            min_underlying_tree_raw: 1_000_000_000_000,
            signer_public_key,
            config_version: 1,
            max_attestation_age_ms,
        }
    }

    #[test_only]
    public fun create_for_testing<T>(
        signer_public_key: vector<u8>,
        max_attestation_age_ms: u64,
        ctx: &mut TxContext,
    ) {
        transfer::share_object(new_for_testing<T>(signer_public_key, max_attestation_age_ms, ctx));
    }

    #[test_only]
    public fun set_config_version_for_testing(config: &mut FifthMoveConfig, config_version: u64) {
        config.config_version = config_version;
    }

    #[test_only]
    public fun destroy_for_testing(config: FifthMoveConfig) {
        let FifthMoveConfig {
            id,
            admin: _,
            enabled: _,
            utility_coin: _,
            min_underlying_tree_raw: _,
            signer_public_key: _,
            config_version: _,
            max_attestation_age_ms: _,
        } = config;
        object::delete(id);
    }
}
