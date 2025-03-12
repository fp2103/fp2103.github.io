// --- MODEL for Solver ---

function fcboard_hash (fcboard) {
    let fc_bits = [0,0,0,0];
    for (let i = 0; i < 4; i++) {
        let c = fcboard.freecells[i];
        if (c) {
            fc_bits[i] = c.uid;
        }
    }
    fc_bits.sort();

    let cols = [];
    for (let i = 0; i < 8; i++) {
        let col_uid = [];
        for (let c of fcboard.columns[i]) {
            col_uid.push(c.uid);
        }
        cols.push(col_uid.toString());
    }
    cols.sort();

    return fc_bits.toString() + ":" + cols.join(':');
}

function choice_hash (fcboard, choice) {
    let cards_bit = [];
    for (let c of choice.cards) {
        cards_bit.push(c.uid);
    }
    cards_bit.sort();

    let orig_col = choice.orig_card;
    if (orig_col != "freecell") {
        let col = fcboard.columns[choice.orig_col_id];
        let col_uid = [];
        for (let i = 0; i < col.length-choice.cards.length; i++) { // don't include moving cards twice in hash
            col_uid.push(col[i].uid);
        }
        orig_col = col_uid.toString();
    }

    let dest_col = choice.dest_card;
    if (dest_col != "freecell" && dest_col != "base") {
        let col = fcboard.columns[choice.dest_col_id];
        let col_uid = [];
        for (let c of col) {
            col_uid.push(c.uid);
        }
        dest_col = col_uid.toString();
    }

    if (orig_col > dest_col) {
        return cards_bit.toString() + ":" + orig_col + "-" + dest_col;
    } else {
        return cards_bit.toString() + ":" + dest_col + "-" + orig_col;
    }
}

class FCSolverGame {
    constructor (fcboard) {
        this.fcboard = fcboard;

        // save current status of board, so that it can be reset
        this.original_freecell = fcboard.freecells.slice();
        this.original_bases = [[], [], [], []];
        for (let i = 0; i < 4; i++) {
            this.original_bases[i] = fcboard.bases[i].slice();
        } 
        this.original_columns = [[], [], [], [], [], [], [], []];
        for (let i = 0; i < 8; i++) {
            this.original_columns[i] = fcboard.columns[i].slice();
        }
        this.original_moves = fcboard.moves.slice();

        // pre compute columns series
        this._column_series = [[], [], [], [], [], [], [], []];
        for (let i = 0; i < 8; i++) {
            this._column_series[i] = this._get_column_series(i);
        }
    }

    reset () {
        this.fcboard = new FCBoard([]);
        this.fcboard.freecells = this.original_freecell.slice();
        for (let i = 0; i < 4; i++) {
            this.fcboard.bases[i] = this.original_bases[i].slice();
        }
        for (let i = 0; i < 8; i++) {
            this.fcboard.columns[i] = this.original_columns[i].slice();
        }
        this.fcboard.moves = this.original_moves.slice();

        for (let i = 0; i < 8; i++) {
            this._column_series[i] = this._get_column_series(i);
        }
    }

    _get_column_series (col_id) {
        let col = this.fcboard.columns[col_id];
        let serie = [];
        let last_card = undefined;
        for (let i = col.length-1; i >= 0; i--) {
            let card = col[i];
            // End last card if last card doesn't match
            if (last_card && 
                (last_card.red == card.red || card.value_num - last_card.value_num != 1)) {
                break;
            }
            serie.push(card)
            last_card = card;
        }
        serie.reverse();
        return serie;
    }

    _update_column_series (col_type, col_id) {
        if (col_type != "freecell" && col_type != "base") {
            this._column_series[col_id] = this._get_column_series(col_id);
        }
    }

    list_choices () {
        /*
          Compute all choices for current state (from destination, except for bases)
        */
        this.fcboard.update_mvt_max();

        let choices = [];

        // Bases from freecell
        for (let fc = 0; fc < 4; fc++) {
            let c = this.fcboard.freecells[fc];
            if (c) {
                let bid = this.fcboard.good_for_base(c);
                if (bid >= 0) {
                    choices.push(new Move([c], "base", bid, "freecell", fc));
                }
            }
        }

        // Columns
        for (let cid = 0; cid < 8; cid++) {
            let col = this._column_series[cid];
            let full_col = this.fcboard.columns[cid];
            if (col.length > 0) {
                let last_card = col[col.length-1];

                let orig_card = "col";
                let orig_cardj = full_col.length-2;
                if (orig_cardj >= 0) {
                    orig_card = full_col[orig_cardj].id_str;
                }

                // to base
                let bid = this.fcboard.good_for_base(last_card);
                if (bid >= 0) {
                    choices.push(new Move([last_card], "base", bid, orig_card, cid));
                }

                // search specific cards (not for ace)
                if (last_card.value_num > 0) {
                    let wanted_is_red = !last_card.red;
                    let wanted_num = last_card.value_num - 1;

                    // from Freecell
                    for (let fc = 0; fc < 4; fc++) {
                        let c = this.fcboard.freecells[fc];
                        if (c && c.value_num == wanted_num && c.red == wanted_is_red) {
                            choices.push(new Move([c], last_card.id_str, cid, "freecell", fc));
                        }
                    }

                    // from other col
                    for (let cid2 = 0; cid2 < 8; cid2++) {
                        if (cid == cid2) { continue; }
                        let col2 = this._column_series[cid2];
                        let full_col2 = this.fcboard.columns[cid2];
                        let j = 0;
                        while (j < col2.length) {
                            let c = col2[j];
                            if (c.value_num == wanted_num && c.red == wanted_is_red
                                 && col2.length-j <= this.fcboard.max_mvt) {

                                let orig_card2 = "col";
                                let orig_cardj = ((full_col2.length-col2.length) + j) - 1;
                                if (orig_cardj >= 0) { orig_card2 = full_col2[orig_cardj].id_str; }
                                
                                choices.push(new Move(col2.slice(j), last_card.id_str, cid, orig_card2, cid2))
                                break;
                            }
                            j++;
                        }
                    }
                }

                // to freecell
                for (let fc = 0; fc < 4; fc++) {
                    if (!this.fcboard.freecells[fc]) {
                        choices.push(new Move([last_card], "freecell", fc, orig_card, cid));
                    }
                }

            } else { // empty col
                // from Freecell
                for (let fc = 0; fc < 4; fc++) {
                    let c = this.fcboard.freecells[fc];
                    if (c) {
                        choices.push(new Move([c], "col", cid, "freecell", fc));
                    }
                }

                // from other col
                for (let cid2 = 0; cid2 < 8; cid2++) {
                    if (cid == cid2) { continue; }
                    let col2 = this._column_series[cid2];
                    let full_col2 = this.fcboard.columns[cid2];
                    let j = Math.max(0, col2.length-this.fcboard.max_mvt_free_col_dest);
                    while (j < col2.length) {
                        let orig_card2 = "col";
                        let orig_cardj = ((full_col2.length-col2.length) + j) - 1;
                        if (orig_cardj >= 0) { orig_card2 = full_col2[orig_cardj].id_str; }
                        choices.push(new Move(col2.slice(j), "col", cid, orig_card2, cid2))
                        j++;
                    }
                }
            }
        }

        return choices;
    }

    apply (choice) {
        this.fcboard.apply_move(choice);
        this._update_column_series(choice.orig_card, choice.orig_col_id);
        this._update_column_series(choice.dest_card, choice.dest_col_id);
    }

}

const MAX_ITER = 10000;

class Solver {
    constructor (fcboard) {
        this.game = new FCSolverGame(fcboard);

        this.noexit = new Set();
        this.called = -1;
        this.all_state_seen = new Map();
    }

    sort_choices (choices_list, use_random, state_seen_count) {
        // Priorities category: weight between -10/10:
        //   base safe -> 100  [cardvalue <= min(bases)+2 !]
        //   base unsafe -> 8/10
        //   1) sorted inc & mvt_max(= or inc) -> 3/10
        //   2) other                          -> -5/5
        //   3) sorted = & mvt_max dec         -> -10/-3
        //   badmove   -> -10
        // bonus: freeforbase +1

        const CAT_basesafe = 100;
        const CAT_baseunsafe = [8,10];
        const CAT1 = [3,10];
        const CAT2 = [-5,5];
        const CAT3 = [-10,-3];
        const CAT_badmove = -10;
        const BONUS_freeforbase = 1;

        // if state was already seen, increase randomness
        let iter_adjust = state_seen_count > 5 ? 5 : state_seen_count; 
        
        function gen_weight(min, max) {
            if (use_random) {
                return (Math.random() * (max - min)) + min;
            } else {
                return (max + min) / 2;
            }
        }

        let b_min = 13;
        for (let b of this.game.fcboard.bases) {
            if (b.length < b_min) {
                b_min = b.length;
            }
        }

        for (let choice of choices_list) {

            // To Base
            if (choice.dest_card == "base") {
                if (choice.cards[0].value_num <= b_min+2) { // Safe
                    choice.weight = CAT_basesafe;
                } else { // Unsafe
                    choice.weight = gen_weight(CAT_baseunsafe[0], CAT_baseunsafe[1]);
                }
                continue;
            }

            // Bad move
            if (choice.bad) {
                choice.weight = CAT_badmove + iter_adjust;
                continue;
            }

            // From 
            let from_fc = choice.orig_card == "freecell";
            let empty_col = !from_fc && (this.game.fcboard.columns[choice.orig_col_id].length == choice.cards.length);
            let split_serie = !from_fc && (this.game._column_series[choice.orig_col_id].length > choice.cards.length);

            // To (freecell or column)
            if (choice.dest_card == "freecell") {
                if (empty_col || split_serie) {  // sorted =
                    choice.weight = gen_weight(CAT3[0], CAT3[1]);
                } else {
                    choice.weight = gen_weight(CAT2[0] - iter_adjust, CAT2[1] + iter_adjust);
                }
            } else if (this.game.fcboard.columns[choice.dest_col_id].length == 0) { // to empty col
                if (from_fc || split_serie) {  // sorted =
                    choice.weight = gen_weight(CAT3[0], CAT3[1]);
                } else {
                    choice.weight = gen_weight(CAT2[0] - iter_adjust, CAT2[1] + iter_adjust);
                }
            } else { // to not empty col
                if (split_serie) { // sorted =
                    choice.weight = gen_weight(CAT2[0] - iter_adjust, CAT2[1] + iter_adjust);
                } else { // sorted inc or max_mvt inc
                    choice.weight = gen_weight(CAT1[0] , CAT1[1]);
                }
            }

            // Bonus: freetobase
            if (!from_fc && !empty_col) {
                let next_card_id = this.game.fcboard.columns[choice.orig_col_id].length - (choice.cards.length+1);
                let next_card = this.game.fcboard.columns[choice.orig_col_id][next_card_id];

                if (next_card.value_num == 0) {
                    choice.weight += BONUS_freeforbase;
                } else {
                    for (let b of this.game.fcboard.bases) {
                        if (b.length > 0) {
                            let last_b = b[b.length-1];
                            if (last_b.suit == next_card.suit) {
                                if (next_card.value_num == last_b.value_num + 1) { // good for base
                                    choice.weight += BONUS_freeforbase;
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        choices_list.sort((a, b) => a.weight - b.weight);
    }

    solve () {
        /*
        Navigate state to solution
        return: {"success": True, "moves": list of moves}
                {"success": False}
        */
        this.called += 1;
        // reset game
        this.game.reset();

        let moves = []; 
        let moves_done = new Set();
        let states_choices = [];
        let current_state = undefined;
        let state_seen = new Set();
        
        let giter = 0;
        while (giter < MAX_ITER) {
            // new state
            let seen = false;
            if (current_state == undefined) {
                
                if (this.game.fcboard.is_won()) {
                    return {"success": true, "moves": moves};
                }
                
                let hashst = fcboard_hash(this.game.fcboard);
                if (state_seen.has(hashst) || this.noexit.has(hashst)) { // go back when state has already been seen 
                    current_state = {"hash": hashst, "choices": []};
                    seen = true;
                } else { // unknown state
                    giter += 1; // only count new state
                    state_seen.add(hashst);
                    let state_count = 0;
                    if (this.all_state_seen.has(hashst)) {
                        state_count = this.all_state_seen.get(hashst) + 1;
                    }
                    this.all_state_seen.set(hashst, state_count);

                    let all_choices = this.game.list_choices();
                    let viable_choices = [];
                    for (let c of all_choices) {
                        let chash = choice_hash(this.game.fcboard, c);
                        c.hash = chash;
                        if (moves_done.has(chash)) {
                            // reinclude 2 bad moves: othewise # 94717719 not solvable
                            //    nonemptycol -> fc
                            //    fc -> emptycol
                            if ((c.orig_card != "col" && c.dest_card == "freecell") || 
                                (c.orig_card == "freecell" && c.dest_card == "col")) {
                                c.bad = true;
                            } else {
                                continue;
                            }
                        }
                        viable_choices.push(c); 
                    }
                    
                    this.sort_choices(viable_choices, true, this.all_state_seen.get(hashst));
                    current_state = {"hash": hashst, "choices": viable_choices};
                }
            }

            // go to next state
            if (current_state.choices.length > 0) {
                let choice = current_state.choices.pop();
                this.game.apply(choice);
                moves.push(choice);
                moves_done.add(choice.hash);
                states_choices.push(current_state);
                current_state = undefined;
            } else { // go back
                let choice = moves.pop();
                if (choice == undefined) throw new Error("no solution found!");
                this.game.apply(get_reverse_move(choice));
                moves_done.delete(choice.hash);
                if (!seen) { // go back cause no more choice
                    this.noexit.add(current_state.hash)
                }
                current_state = states_choices.pop();
            }
        }

        return {"success": false};
    }

    moves_reducer (moves) {
        this.game.reset();

        let nmoves = moves.slice();
        let i = 0;
        while (i < nmoves.length) {
            let mvt = nmoves[i];

            // searching next moves with same cards
            let j = i+1;
            while (j < nmoves.length) {
                if (nmoves[j].cards.length == mvt.cards.length &&
                    nmoves[j].cards.every((c, k) => c.uid == mvt.cards[k].uid)) { // found possible replacement
                    let nmvt = new Move(mvt.cards, nmoves[j].dest_card, nmoves[j].dest_col_id, mvt.orig_card, mvt.orig_col_id);

                    let ngame = new FCSolverGame(this.game.fcboard);
                    ngame.reset(); // create new board out of current one
                    let impact = false;
                    let m = nmvt;
                    let k = i;
                    while (!impact && k < nmoves.length) {
                        let possible = false;
                        for (let choice of ngame.list_choices()) {
                            if (choice.equals(m)) {
                                possible = true;
                                break;
                            }
                        }
                        if (possible) {
                            ngame.apply(m);
                            k += 1;
                            if (k == j) { k += 1; } // skip possible replacement
                            if (k < nmoves.length) {
                                m = nmoves[k];
                            }
                        } else {
                            impact = true;
                        }
                    }
                    
                    if (!impact) {
                        nmoves[i] = nmvt;
                        nmoves.splice(j, 1);
                    } else {
                        break;
                    }
                }
                j += 1;
            }
        
            this.game.apply(nmoves[i])
            i += 1;
        }

        return nmoves;
    }


}

/*
# 94717719: solvable 
# 57148 very difficult
# 11982 impossible game:

difficult:
2JL02
AGHDO
PN9RW

jC      5C  2H  5S  0X  0X  0X  

9S  aH  kS  10D     6S  3D  aC  
8H  4H      3C      5D      7H  
    kH      aD              7C  
    4D      6D              7S  
    8D      6H              2D  
    qD      qC              kC  
    kD      jH              qH  
    qS      10C             jS  
    jD      9H              10H 
    10S     8C              9C  
    9D                          
    8S                          
    7D                          
    6C                          
    5H                          
    4C                          
    3H                          
    2C   

# 98714 (need base unsafe)
# 739671

*/