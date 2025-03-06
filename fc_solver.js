// --- MODEL for Solver ---

function fcboard_hash (fcboard) {
    let fc_bits = 0;
    for (let c of fcboard.freecells) {
        if (c) {
            fc_bits += 1 << c.uid;
        }
    }

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
    let cards_bit = 0;
    for (let c of choice.cards) {
        cards_bit += 1 << c.uid;
    }

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

const MAX_ITER = 5000;

class Solver {
    constructor (fcboard) {
        this.game = new FCSolverGame(fcboard);

        this.noexit = new Set();
        this.called = -1;
    }

    sort_choices (choices_list, use_random) {
        // Priorities category:
        // 1) base & reduce base diff
        // 2) sorted inc & mvt_max(= or inc)
        // 3) other
        // 4) sorted = & mvt_max dec

        const CAT1 = 10000;
        const CAT2 = 5;
        const CAT3 = 1;
        const CAT4 = 0;
        let rfactor = 0.4;
        if (this.called > 0) {
            rfactor = this.called;
        }

        for (let choice of choices_list) {
            let crand = 0;
            if (use_random) {
                crand = (2*rfactor*Math.random())-rfactor;
            }

            // From 
            let from_fc = choice.orig_card == "freecell";
            let empty_col = !from_fc && (this.game.fcboard.columns[choice.orig_col_id].length == choice.cards.length);
            let split_serie = !from_fc && (this.game._column_series[choice.orig_col_id].length > choice.cards.length);

            // To
            if (choice.dest_card == "base") {
                let bases_len = [];
                let i = 0;
                for (let b = 0; b < 4; b++) {
                    let base = this.game.fcboard.bases[b];
                    bases_len.push(base.length);
                    if (base.length > 0 && base[0].suit == choice.cards[0].suit) {
                        i = b;
                    }
                }
                let diff_bases = Math.max(...bases_len) - Math.min(...bases_len);

                bases_len[i] += 1;
                let new_diff_bases = Math.max(...bases_len) - Math.min(...bases_len);

                if (new_diff_bases < diff_bases) {
                    choice.weight = CAT1 + crand;
                } else {
                    choice.weight = CAT2 + crand;
                }
            } else if (choice.dest_card == "freecell") {
                if (empty_col || split_serie) {
                    choice.weight = CAT4 + crand;
                } else {
                    choice.weight = CAT3 + crand;
                }
            } else if (this.game.fcboard.columns[choice.dest_col_id].length == 0) { // to empty col
                if (from_fc || split_serie) {
                    choice.weight = CAT4 + crand;
                } else {
                    choice.weight = CAT3 + crand;
                }
            } else { // to not empty col
                if (split_serie) { // sorted =
                    choice.weight = CAT3 + crand;
                } else { // sorted inc or max_mvt inc
                    choice.weight = CAT2 + crand;
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
            giter += 1;        

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
                } else {
                    state_seen.add(hashst)

                    let all_choices = this.game.list_choices();
                    let viable_choices = [];
                    for (let c of all_choices) {
                        let chash = choice_hash(this.game.fcboard, c);
                        c.hash = chash;
                        if (moves_done.has(chash)) {
                            continue;
                        } else {
                            viable_choices.push(c);
                        }
                    }
                    
                    this.sort_choices(viable_choices, true);
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
7S  4C  7H  3C  8S  6C  9S  kH  
8H  10S 2H  jC  7C  10C 4D  kC  
5H  8D  kS  6D  3D  aC  qD  6S  
5D  9H  qH  qS  5C  kD  9D  4H  
3S  jH  7D  9C  jS  2C  aH  6H  
2D  10D 3H  qC  2S  10H 8C  aS  
jD  4S  5S  aD  
*/