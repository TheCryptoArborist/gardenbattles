module battle_garden::utils {
    use sui::random::{Self, Random};

    public fun add_growth(arg0: u64, arg1: u64): u64 {
        clamp(arg0 + arg1, 0, 100)
    }

    public fun sub_growth(arg0: u64, arg1: u64): u64 {
        if (arg0 > arg1) {
            arg0 - arg1
        } else {
            0
        }
    }

    public fun clamp(arg0: u64, arg1: u64, arg2: u64): u64 {
        if (arg0 < arg1) {
            arg1
        } else if (arg0 > arg2) {
            arg2
        } else {
            arg0
        }
    }

    public fun clone_vec_u8(arg0: &vector<u8>): vector<u8> {
        let mut v0 = vector::empty<u8>();
        let mut i = 0;
        while (i < vector::length(arg0)) {
            vector::push_back(&mut v0, *vector::borrow(arg0, i));
            i = i + 1;
        };
        v0
    }

    public fun contains_u8(v: &vector<u8>, val: u8): bool {
        let mut i = 0;
        while (i < vector::length(v)) {
            if (*vector::borrow(v, i) == val) {
                return true
            };
            i = i + 1;
        };
        false
    }
    
    public fun eq_str(arg0: vector<u8>, arg1: vector<u8>): bool {
        if (vector::length(&arg0) != vector::length(&arg1)) {
            return false
        };
        let mut i = 0;
        while (i < vector::length(&arg0)) {
            if (*vector::borrow(&arg0, i) != *vector::borrow(&arg1, i)) {
                return false
            };
            i = i + 1;
        };
        true
    }
    public(package) fun miss(_arg0: &Random, _arg1: &mut TxContext, arg2: u64): bool {
        let mut rng = random::new_generator(_arg0, _arg1);
        random::generate_u64(&mut rng) % 100 < arg2
    }
    public(package) fun rand_inclusive(_arg0: &Random, _arg1: &mut TxContext, arg2: u64, arg3: u64): u64 {
        if (arg3 <= arg2) {
            return arg2
        };
        let mut rng = random::new_generator(_arg0, _arg1);
        arg2 + (random::generate_u64(&mut rng) % (arg3 - arg2 + 1))
    }
}
