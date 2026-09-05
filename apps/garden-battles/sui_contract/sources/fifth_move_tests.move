#[test_only]
module battle_garden::fifth_move_tests {
    use sui::clock;
    use sui::test_scenario;
    use battle_garden::fifth_move::{Self, FifthMoveConfig};

    public struct TREE has drop {}

    const ADMIN: address = @0xA;
    const PLAYER: address = @0xB;
    const OTHER: address = @0xC;
    const THRESHOLD: u64 = 1_000_000_000_000;
    const ISSUED_AT_MS: u64 = 1_000_000;
    const EXPIRES_AT_MS: u64 = 1_120_000;
    const CONFIG_ID: address = @0xd726ecf6f7036ee3557cd6c7b93a49b231070e8eecada9cfa157e40e3f02e5d3;

    fun signer_public_key(): vector<u8> {
        vector[
            234, 74, 108, 99, 226, 156, 82, 10,
            190, 245, 80, 123, 19, 46, 197, 249,
            149, 71, 118, 174, 190, 190, 123, 146,
            66, 30, 234, 105, 20, 70, 210, 44,
        ]
    }

    fun valid_signature(): vector<u8> {
        vector[
            111, 95, 109, 222, 12, 233, 108, 227,
            189, 227, 155, 210, 146, 224, 154, 188,
            131, 221, 199, 112, 212, 226, 152, 73,
            87, 65, 251, 139, 99, 227, 66, 77,
            62, 200, 15, 183, 89, 239, 106, 2,
            200, 59, 110, 103, 227, 1, 156, 221,
            17, 112, 219, 122, 156, 38, 14, 160,
            74, 64, 56, 127, 240, 79, 171, 12,
        ]
    }

    fun issued_equals_expires_signature(): vector<u8> {
        vector[
            192, 80, 89, 86, 85, 79, 53, 244,
            42, 219, 244, 187, 31, 92, 205, 60,
            229, 202, 123, 226, 167, 22, 211, 191,
            60, 113, 5, 251, 201, 57, 113, 150,
            153, 224, 80, 154, 172, 230, 229, 204,
            149, 12, 254, 148, 14, 26, 218, 60,
            33, 78, 219, 127, 248, 128, 127, 10,
            90, 206, 200, 221, 184, 176, 251, 13,
        ]
    }

    fun future_skew_boundary_signature(): vector<u8> {
        vector[
            31, 173, 228, 91, 46, 5, 40, 226,
            9, 17, 165, 244, 113, 185, 131, 229,
            79, 133, 222, 152, 247, 165, 20, 50,
            62, 249, 252, 126, 108, 145, 100, 178,
            16, 108, 201, 144, 233, 153, 116, 210,
            149, 194, 125, 102, 138, 199, 126, 24,
            193, 22, 8, 112, 64, 157, 11, 63,
            108, 164, 94, 101, 221, 22, 245, 14,
        ]
    }

    fun max_age_boundary_signature(): vector<u8> {
        vector[
            232, 31, 241, 185, 168, 6, 215, 125,
            97, 30, 91, 212, 13, 217, 42, 204,
            164, 177, 114, 124, 110, 176, 77, 28,
            89, 81, 44, 162, 252, 155, 187, 186,
            127, 100, 122, 243, 56, 162, 203, 140,
            215, 24, 10, 204, 8, 182, 205, 134,
            215, 226, 67, 66, 45, 225, 156, 49,
            185, 168, 139, 43, 7, 252, 34, 1,
        ]
    }

    fun long_signature(): vector<u8> {
        let mut sig = valid_signature();
        vector::push_back(&mut sig, 0);
        sig
    }

    fun short_public_key(): vector<u8> {
        vector[1, 2, 3]
    }

    fun long_public_key(): vector<u8> {
        vector[
            234, 74, 108, 99, 226, 156, 82, 10,
            190, 245, 80, 123, 19, 46, 197, 249,
            149, 71, 118, 174, 190, 190, 123, 146,
            66, 30, 234, 105, 20, 70, 210, 44,
            1,
        ]
    }

    fun enabled_config(s: &mut test_scenario::Scenario) {
        test_scenario::next_tx(s, ADMIN);
        {
            fifth_move::create_for_testing<TREE>(signer_public_key(), 300_000, test_scenario::ctx(s));
        };

        test_scenario::next_tx(s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(s);
            fifth_move::set_enabled(&mut config, true, test_scenario::ctx(s));
            test_scenario::return_shared(config);
        };
    }

    fun valid_payload() : fifth_move::FifthMoveAttestationPayload {
        fifth_move::payload(
            CONFIG_ID,
            PLAYER,
            true,
            THRESHOLD,
            THRESHOLD,
            5,
            2,
            ISSUED_AT_MS,
            EXPIRES_AT_MS,
        )
    }

    fun valid_payload_with_times(
        issued_at_ms: u64,
        expires_at_ms: u64,
    ): fifth_move::FifthMoveAttestationPayload {
        fifth_move::payload(
            CONFIG_ID,
            PLAYER,
            true,
            THRESHOLD,
            THRESHOLD,
            5,
            2,
            issued_at_ms,
            expires_at_ms,
        )
    }

    fun assert_valid_proof(
        config: &FifthMoveConfig,
        payload: fifth_move::FifthMoveAttestationPayload,
        signature: vector<u8>,
        now_ms: u64,
        s: &mut test_scenario::Scenario,
    ) {
        let mut clk = clock::create_for_testing(test_scenario::ctx(s));
        clock::set_for_testing(&mut clk, now_ms);
        let eligibility = fifth_move::verify_attestation(
            config,
            payload,
            signature,
            &clk,
            test_scenario::ctx(s),
        );
        assert!(fifth_move::entitled(&eligibility), 0);
        clock::destroy_for_testing(clk);
    }

    #[test]
    fun valid_attestation_qualifies_sender() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);

            let eligibility = fifth_move::verify_attestation(
                &config,
                valid_payload(),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );

            assert!(fifth_move::entitled(&eligibility), 0);
            assert!(fifth_move::verified_underlying_tree_raw(&eligibility) == THRESHOLD, 0);
            assert!(fifth_move::source_bitmap(&eligibility) == 5, 0);
            assert!(fifth_move::eligibility_config_version(&eligibility) == 2, 0);
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 126)]
    fun wrong_config_object_id_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            let payload = fifth_move::payload(
                @0x1,
                PLAYER,
                true,
                THRESHOLD,
                THRESHOLD,
                5,
                2,
                ISSUED_AT_MS,
                EXPIRES_AT_MS,
            );
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config,
                payload,
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 128)]
    fun malformed_signature_length_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config,
                valid_payload(),
                vector[1, 2, 3],
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 129)]
    fun invalid_source_bitmap_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            let payload = fifth_move::payload(
                CONFIG_ID,
                PLAYER,
                true,
                THRESHOLD,
                THRESHOLD,
                32,
                2,
                ISSUED_AT_MS,
                EXPIRES_AT_MS,
            );
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config,
                payload,
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 130)]
    fun invalid_timestamp_order_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            let payload = fifth_move::payload(
                CONFIG_ID,
                PLAYER,
                true,
                THRESHOLD,
                THRESHOLD,
                5,
                2,
                EXPIRES_AT_MS,
                ISSUED_AT_MS,
            );
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config,
                payload,
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 117)]
    fun attestation_cannot_be_used_by_another_wallet() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, OTHER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config,
                valid_payload(),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 116)]
    fun corrupted_signature_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            let mut sig = valid_signature();
            *vector::borrow_mut(&mut sig, 0) = 0;
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config,
                valid_payload(),
                sig,
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 121)]
    fun expired_attestation_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, EXPIRES_AT_MS + 1);
            fifth_move::verify_attestation(
                &config,
                valid_payload(),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 126)]
    fun real_config_a_proof_fails_against_real_config_b() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            fifth_move::create_for_testing<TREE>(signer_public_key(), 300_000, test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config_b = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_enabled(&mut config_b, true, test_scenario::ctx(&mut s));
            test_scenario::return_shared(config_b);
        };

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config_a = test_scenario::take_shared<FifthMoveConfig>(&s);
            let config_b = test_scenario::take_shared<FifthMoveConfig>(&s);
            assert_valid_proof(
                &config_a,
                valid_payload(),
                valid_signature(),
                ISSUED_AT_MS + 1_000,
                &mut s,
            );
            assert!(fifth_move::config_version(&config_a) == fifth_move::config_version(&config_b), 0);

            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(
                &config_b,
                valid_payload(),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config_b);
            test_scenario::return_shared(config_a);
        };
        test_scenario::end(s);
    }

    #[test]
    fun config_version_increments_once_for_each_material_update() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            assert!(fifth_move::config_version(&config) == 2, 0);
            fifth_move::rotate_signer(&mut config, long_public_key_drop_last(), test_scenario::ctx(&mut s));
            assert!(fifth_move::config_version(&config) == 3, 0);
            fifth_move::set_threshold(&mut config, THRESHOLD + 1, test_scenario::ctx(&mut s));
            assert!(fifth_move::config_version(&config) == 4, 0);
            fifth_move::set_max_attestation_age(&mut config, 400_000, test_scenario::ctx(&mut s));
            assert!(fifth_move::config_version(&config) == 5, 0);
            fifth_move::set_enabled(&mut config, false, test_scenario::ctx(&mut s));
            assert!(fifth_move::config_version(&config) == 6, 0);
            fifth_move::set_enabled(&mut config, true, test_scenario::ctx(&mut s));
            assert!(fifth_move::config_version(&config) == 7, 0);
            fifth_move::transfer_admin(&mut config, OTHER, test_scenario::ctx(&mut s));
            assert!(fifth_move::admin(&config) == OTHER, 0);
            assert!(fifth_move::config_version(&config) == 7, 0);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    fun long_public_key_drop_last(): vector<u8> {
        vector[
            234, 74, 108, 99, 226, 156, 82, 10,
            190, 245, 80, 123, 19, 46, 197, 249,
            149, 71, 118, 174, 190, 190, 123, 146,
            66, 30, 234, 105, 20, 70, 210, 45,
        ]
    }

    #[test]
    #[expected_failure(abort_code = 120)]
    fun disabling_and_reenabling_invalidates_old_proof() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_enabled(&mut config, false, test_scenario::ctx(&mut s));
            fifth_move::set_enabled(&mut config, true, test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(&config, valid_payload(), valid_signature(), &clk, test_scenario::ctx(&mut s));
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 132)]
    fun noop_signer_rotation_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::rotate_signer(&mut config, signer_public_key(), test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 132)]
    fun noop_threshold_update_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_threshold(&mut config, THRESHOLD, test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 132)]
    fun noop_max_age_update_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_max_attestation_age(&mut config, 300_000, test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 132)]
    fun noop_enabled_update_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_enabled(&mut config, true, test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 131)]
    fun version_overflow_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_config_version_for_testing(&mut config, 18446744073709551615);
            fifth_move::set_enabled(&mut config, false, test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    fun timestamp_boundaries_accept_exact_edges() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);

        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            assert_valid_proof(
                &config,
                valid_payload_with_times(1_000_000, 1_000_000),
                issued_equals_expires_signature(),
                1_000_000,
                &mut s,
            );
            assert_valid_proof(
                &config,
                valid_payload_with_times(1_060_000, 1_120_000),
                future_skew_boundary_signature(),
                1_000_000,
                &mut s,
            );
            assert_valid_proof(
                &config,
                valid_payload_with_times(1_000_000, 1_300_000),
                max_age_boundary_signature(),
                1_000_000,
                &mut s,
            );
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 122)]
    fun timestamp_one_ms_beyond_future_skew_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, 1_000_000);
            fifth_move::verify_attestation(
                &config,
                valid_payload_with_times(1_060_001, 1_120_000),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 121)]
    fun timestamp_one_ms_after_expiration_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, EXPIRES_AT_MS + 1);
            fifth_move::verify_attestation(&config, valid_payload(), valid_signature(), &clk, test_scenario::ctx(&mut s));
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 121)]
    fun timestamp_lifetime_one_ms_above_max_age_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, 1_000_000);
            fifth_move::verify_attestation(
                &config,
                valid_payload_with_times(1_000_000, 1_300_001),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 130)]
    fun timestamp_near_u64_max_ordering_is_rejected_before_overflow() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, 1_000_000);
            fifth_move::verify_attestation(
                &config,
                valid_payload_with_times(18446744073709551615, 18446744073709551614),
                valid_signature(),
                &clk,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 127)]
    fun initialization_rejects_short_signer_public_key() {
        let mut s = test_scenario::begin(ADMIN);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            fifth_move::create_for_testing<TREE>(short_public_key(), 300_000, test_scenario::ctx(&mut s));
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 127)]
    fun initialization_rejects_long_signer_public_key() {
        let mut s = test_scenario::begin(ADMIN);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            fifth_move::create_for_testing<TREE>(long_public_key(), 300_000, test_scenario::ctx(&mut s));
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 127)]
    fun signer_rotation_rejects_short_key() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::rotate_signer(&mut config, short_public_key(), test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 127)]
    fun signer_rotation_rejects_long_key() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut config = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::rotate_signer(&mut config, long_public_key(), test_scenario::ctx(&mut s));
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 128)]
    fun malformed_long_signature_length_is_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            fifth_move::verify_attestation(&config, valid_payload(), long_signature(), &clk, test_scenario::ctx(&mut s));
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    fun same_sender_can_reuse_same_attestation_during_ttl() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            assert_valid_proof(&config, valid_payload(), valid_signature(), ISSUED_AT_MS + 1_000, &mut s);
            assert_valid_proof(&config, valid_payload(), valid_signature(), ISSUED_AT_MS + 1_000, &mut s);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 121)]
    fun expired_proof_cannot_be_reused() {
        let mut s = test_scenario::begin(ADMIN);
        enabled_config(&mut s);
        test_scenario::next_tx(&mut s, PLAYER);
        {
            let config = test_scenario::take_shared<FifthMoveConfig>(&s);
            assert_valid_proof(&config, valid_payload(), valid_signature(), ISSUED_AT_MS + 1_000, &mut s);
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            clock::set_for_testing(&mut clk, EXPIRES_AT_MS + 1);
            fifth_move::verify_attestation(&config, valid_payload(), valid_signature(), &clk, test_scenario::ctx(&mut s));
            clock::destroy_for_testing(clk);
            test_scenario::return_shared(config);
        };
        test_scenario::end(s);
    }
}
