// --- MODEL ---

const CARDS_N = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
const SUITS = ['H', 'S', 'D', 'C'];

class Card {
    constructor (value, suit) {
        this.value = value;
        this.suit = suit;
        this.red = suit == 'H' || suit == 'D';
        this.value_num = CARDS_N.indexOf(value);
        this.id_str = "card_" + value + suit;

        this.uid = (this.value_num << 2) + SUITS.indexOf(suit); 
    }

    getHtmlElement () {
        return document.getElementById(this.id_str);
    }

    equals (other) {
        return this.uid == other.uid;
    }
}

class Move {
    constructor (cards, dest_card, dest_col_id, orig_card, orig_col_id) {
        this.cards = cards;
        this.dest_card = dest_card;
        this.dest_col_id = dest_col_id;
        this.orig_card = orig_card;
        this.orig_col_id = orig_col_id;

        this.dest_view_id = dest_card;
        if (!dest_card.includes("card")) {
            this.dest_view_id += "_" + dest_col_id;
        }

        this.weight = 0;
        this.hash = "";
    }

    equals (other) {
        return this.cards.length == other.cards.length &&
                this.cards.every((c, i) => c.uid == other.cards[i].uid) &&
                this.dest_card == other.dest_card && this.dest_col_id == other.dest_col_id &&
                this.orig_card == other.orig_card && this.orig_col_id == other.orig_col_id;
    }

    to_string () {
        let move_str = "";
        
        let last_i = this.cards.length-1;
        if (this.cards.length <= 3) {
            for (let i = 0; i < last_i; i++) {
                move_str += this.cards[i].value + this.cards[i].suit + ",";
            }
        } else {
            move_str += this.cards[0].value + this.cards[0].suit + "..";
        }
        move_str += this.cards[last_i].value + this.cards[last_i].suit;
        
        move_str += " from ";
        if (this.orig_card == "freecell") {
            move_str += this.orig_card;
        } else {
            move_str += "column " + this.orig_col_id;
        }

        move_str += " to ";
        if (this.dest_card == "freecell" || this.dest_card == "base") {
            move_str += this.dest_card;
        } else {
            move_str += "column " + this.dest_col_id;
        }

        return move_str;        
    }
}

function get_reverse_move (move) {
    return new Move(move.cards, move.orig_card, move.orig_col_id, move.dest_card, move.dest_col_id);
}

class FCBoard {
    constructor (deck) {
        this.freecells = [null, null, null, null];
        this.bases = [[], [], [], []];
        this.columns = [[], [], [], [], [], [], [], []];

        let i = 0;
        for (let c of deck) {
            this.columns[i].push(c);
            i < 7 ? i = i+1 : i = 0;
        }

        this.max_mvt = 0;
        this.max_mvt_free_col_dest = 0;
        this.update_mvt_max();

        this.moves = [];
        this.back_count = 0;
    }

    update_mvt_max () {
        let free_col = 0;
        for (let col of this.columns) {
            if (col.length == 0) free_col += 1;
        }
        let occupied_freecell = 0;
        for (let fc of this.freecells) {
            if (fc != null) occupied_freecell += 1;
        }
        this.max_mvt = (5 - occupied_freecell) * (2 ** free_col);
        this.max_mvt_free_col_dest = this.max_mvt/2;
    }

    good_for_base (card) {
        /*
          return id of base if good for base or -1 if not
         */

        if (card.value == 'a') { // ace
            for (let i = 0; i < this.bases.length; i++) {
                if (this.bases[i].length == 0) {
                    return i;
                }
            }
        } else { // non ace
            for (let i = 0; i < this.bases.length; i++) {
                let b = this.bases[i];
                if (b.length > 0) {
                    let top_b = b[b.length-1];
                    if (top_b.suit == card.suit && card.value_num - top_b.value_num == 1) {
                        return i;
                    }
                }
            }
        }
        return -1;
    }

    _find_targets (top_card, cards_moving_len, from_freecell, orig_id) {
        let targets = [];

        // base
        if (cards_moving_len == 1) {
            let b = this.good_for_base(top_card);
            if (b >= 0) {
                targets.push("base_" + b);
            }
        }

        // columns
        let empty_cols_target = new Array();
        for (let i = 0; i < this.columns.length; i++) {
            if (from_freecell || orig_id != i) {
                let col = this.columns[i];
                if (col.length > 0) { // non empty col
                    let top_col = col[col.length-1];
                    if (top_col.value_num - top_card.value_num == 1 && top_col.red != top_card.red) {
                        targets.push(top_col.id_str);
                    }
                } else if (cards_moving_len <= this.max_mvt_free_col_dest) { // empty col
                    empty_cols_target.push("col_" + i);
                } 
            }
        }
        targets.push(...empty_cols_target);
        
        // freecells
        if (cards_moving_len == 1) {
            for (let i = 0; i < this.freecells.length; i++) {
                if (this.freecells[i] == null) {
                    targets.push("freecell_" + i);
                }
            }
        }

        return targets;
    }

    get_card_target (card_id) {
        /*
          find possible destination for a card,
          retruns {list of moving card (series), list of targets, origin}
         */

        // Find Card
        let orig_id = -1;
        let orig_str = "";
        let moving_cards = [];

        // look in freecells
        let from_freecell = false;
        for (let i = 0; i < this.freecells.length; i++) {
            let c = this.freecells[i];
            if (c && c.id_str == card_id) {
                moving_cards.push(c);
                from_freecell = true
                orig_id = i;
                orig_str = "freecell_" + i;
                break;
            }
        }

        // look in columns
        for (let i = 0; i < this.columns.length; i++) {
            if (orig_id >= 0) break; // already found
            
            let col = this.columns[i];
            for (let j = 0; j < col.length; j++) {
                let c = col[j];
                if (c.id_str == card_id) {
                    moving_cards = col.slice(j, col.length);
                    orig_id = i;
                    if (j > 0) {
                        orig_str = col[j-1].id_str;
                    } else {
                        orig_str = "col_" + i;
                    }
                    break;
                }
            }
        }

        if (orig_id < 0) {
            throw new Error(card_id + " not found");
        }

        return {moving_cards: moving_cards, 
                targets: this._find_targets(moving_cards[0], moving_cards.length, from_freecell, orig_id),
                origin: orig_str};
    }

    _create_move (cards, dest) {
        // Setup dest
        let dest_card = dest.split('_')[0];
        let dest_col_id = dest.split('_')[1];
        if (dest_card == "card") {
            dest_card = dest; // put full card name
            for (let i = 0; i < this.columns.length; i++) {
                let col = this.columns[i];
                if (col.length > 0 && dest == col[col.length-1].id_str) {
                    dest_col_id = i;
                    break;
                }
            }
        }

        // Find origin
        let top_card = cards[0];
        let bottom_card = cards[cards.length-1];

        // freecell
        for (let i = 0; i < this.freecells.length; i++) {
            if (this.freecells[i] && this.freecells[i].equals(top_card)) {
                return new Move(cards, dest_card, dest_col_id, "freecell", i);
            }
        }

        // columns
        for (let i = 0; i < this.columns.length; i++) {
            let col = this.columns[i]; 
            if (col.length > 0 && col[col.length-1].equals(bottom_card)) {
                let ncol = col.slice(0, col.length-cards.length);
                if (ncol.length > 0) { // col not empty
                    let nxt_card = ncol[ncol.length-1];
                    return new Move(cards, dest_card, dest_col_id, nxt_card.id_str, i);
                } else { // col empty
                    return new Move(cards, dest_card, dest_col_id, "col", i);
                }
            }
        }

        // bases
        for (let i = 0; i < this.bases.length; i++) {
            let b = this.bases[i];
            if (b.length > 0 && b[b.length-1].equals(top_card)) {
                return new Move(cards, dest_card, dest_col_id, "base", i);
            }
        }
    }

    new_move (cards, dest) {
        let nm = this._create_move(cards, dest);
        if (this.back_count > 0) {
            let next_known_move = this.moves[this.moves.length - this.back_count];
            if (nm.equals(next_known_move)) { // exact same move
                this.back_count -= 1;
            } else if (nm.cards.length == 1 && next_known_move.cards.length == 1 &&
                    nm.cards[0].uid == next_known_move.cards[0].uid &&
                    nm.dest_card == "freecell" && next_known_move.dest_card == "freecell") {
                // update model to match new view on all next moves!
                let oldid = next_known_move.dest_col_id;
                let newid = nm.dest_col_id;

                for (let i = this.moves.length - this.back_count; i < this.moves.length; i++) {
                    let m = this.moves[i];
                    if (m.dest_card == "freecell") {
                        if (m.dest_col_id == oldid) {
                            m.dest_col_id = newid;
                            m.dest_view_id = "freecell_" + newid; 
                        } else if (m.dest_col_id == newid) {
                            m.dest_col_id = oldid;
                            m.dest_view_id = "freecell_" + oldid;
                        }
                    }
                    if (m.orig_card == "freecell") {
                        if (m.orig_col_id == oldid) {
                            m.orig_col_id = newid;
                        } else if (m.orig_col_id == newid) {
                            m.orig_col_id = oldid;
                        }
                    }
                }                

                this.back_count -= 1;
            } else {
                this.moves.splice(this.moves.length - this.back_count);
                this.back_count = 0;
                this.moves.push(nm);
            }
        } else {
            this.moves.push(nm);
        }
        return nm;
    }

    move_forward () {
        let m = null;
        if (this.back_count > 0) {
            m = this.moves[this.moves.length-this.back_count];
            this.back_count -= 1;
        }
        return m;
    }

    move_backward () {
        let m = null;
        if (this.back_count < this.moves.length) {
            this.back_count += 1;
            m = get_reverse_move(this.moves[this.moves.length-this.back_count]);
        }
        return m;
    }

    apply_move (move) {
        /*
          update model
        */

        // Remove from origin
        if (move.orig_card == "freecell") {
            if (!this.freecells[move.orig_col_id]) {
                throw new Error("Emptying free freecell");
            }
            this.freecells[move.orig_col_id] = null;
        } else if (move.orig_card == "base") {
            this.bases[move.orig_col_id].pop();
        } else { // column
            let col  = this.columns[move.orig_col_id];
            this.columns[move.orig_col_id] = col.slice(0, col.length-move.cards.length);
        }

        // Move to dest
        if (move.dest_card == "freecell") {
            if (this.freecells[move.dest_col_id]) {
                throw new Error("Putting to non empty freecell");
            }
            this.freecells[move.dest_col_id] = move.cards[0];
        } else if (move.dest_card == "base") {
            this.bases[move.dest_col_id].push(move.cards[0]);
        } else { // columns
            this.columns[move.dest_col_id].push(...move.cards);
        }
    }

    get_movable_cards () {
        /*
          return list of cards that may move
        */

        let ret = new Array();

        // freecells
        for (let c of this.freecells) {
            if (c && this.max_mvt > 0) {
                ret.push(c);
            }
        }

        // columns
        for (let col of this.columns) {
            let i = col.length-1;
            let j = 1;
            let series = true;
            while (i >= 0 && j <= this.max_mvt && series) {
                let c = col[i];
                ret.push(c);
                j = j+1;
                i = i-1;
                if (i >= 0) {
                    series = (col[i].value_num - c.value_num == 1 && col[i].red != c.red);
                }
            }
        }

        return ret;
    }

    is_won () {
        let win = true;
        for (let b of this.bases) {
            win = win && (b.length == 13);
        }
        return win;
    }

    get_board_status () {
        /* 
          return if win or blocked or not
        */
        if (this.is_won()) {
            return "WIN";
        }

        if (this.max_mvt > 1) { // can move more than 1 card
            return "OK";
        }


        // freecell
        for (let c of this.freecells) {
            if (c && this._find_targets(c, 1, true, 0).length > 0) {
                return "OK";
            }
        }
        // columns
        for (let i = 0; i < this.columns.length; i++) {
            let col = this.columns[i];
            if (col.length > 0 && this._find_targets(col[col.length-1], 1, false, i).length > 0) {
                return "OK";
            }
        }

        return "GAMEOVER";
    }

    discard_futur_moves () {
        this.moves.splice(this.moves.length - this.back_count);
        this.back_count = 0;
    }
}

function create_card_from_string (card_str, pos_msg) {
    let suit = card_str[card_str.length-1].toUpperCase();
    if (!SUITS.includes(suit)) {
        throw new Error("Reading card: " + card_str + ", Wrong suit" + pos_msg);
    }
    let value = card_str.slice(0, -1).toLowerCase();
    if (!CARDS_N.includes(value)) {
        throw new Error("Reading card: " + card_str + ", Wrong value" + pos_msg);
    }
    return new Card(value, suit);
}

function create_from_string (game_str) {
    
    let nfboard = new FCBoard(DECK);
    for (let i = 0; i < 8; i++) { // empty columns
        nfboard.columns[i] = [];
    }
    let deck_compare = DECK.slice();

    function read_card (card_str, line, col) {
        let cstr = card_str.trim();
        let pos_msg = " (at line: " + line + " col: " + col + ")";
        if (cstr.length == 0) {
            return null;
        }

        let nc = create_card_from_string(cstr, pos_msg);
        let in_deck = false;
        let deck_idx = 0;
        for (let c of deck_compare) {
            if (nc.equals(c)) {
                in_deck = true;
                break;
            }
            deck_idx += 1;
        }
        if (!in_deck) { // not in deck anymore, duplicate
            throw new Error("Card " + cstr + " appears more than once" + pos_msg);
        } else { // in_deck, remove
            deck_compare.splice(deck_idx, 1);
        }
        return nc;
    }

    let lines = game_str.split('\n');

    function split_line (line) {
        let ret = [];
        let empty_count = 0;
        for (let c of line.split(' ')) {
            if (c) {
                ret.push(c);
                empty_count = 0;
            } else {
                empty_count += 1;
                if (empty_count > 3) {
                    ret.push('');
                    empty_count = 0;
                }
            }
        }

        // remove empty element at the end
        let a = ret.pop();
        while (a == '') {
            a = ret.pop();
        }
        if (a != undefined) {
            ret.push(a);
        }

        // pad to 8 columns
        let j = ret.length;
        if (j > 8) {
            throw new Error("Line is too big, 8 columns (4 spaces wide) only");
        }
        for (let i = j; i < 8; i++) {
            ret.push('');
        }
        return ret;
    }

    let first_line_list = split_line(lines[0]);
    // freecells
    for (let i = 0; i < 4; i++) {
        let c = read_card(first_line_list[i], 0, i);
        nfboard.freecells[i] = c;
    }

    // bases
    for (let i = 4; i < 8; i++) {
        let b = [];

        if (first_line_list[i].trim().toUpperCase() == "0X") {
            continue;
        }
        let last_c = read_card(first_line_list[i], 0, i);

        for (let j = 0; j < last_c.value_num; j++) {
            b.push(read_card(CARDS_N[j] + last_c.suit, 0, i));
        }
        b.push(last_c);
        nfboard.bases[i-4] = b;
    }

    // lines (2nd line is skipped)
    for (let i = 2; i < lines.length; i++) {
        let line_list = split_line(lines[i]);
        for (let j = 0; j < line_list.length; j++) {
            let c = read_card(line_list[j], i, j);
            if (c) {
                nfboard.columns[j].push(c);
            }
        }
    }

    // verify all cards found
    if (deck_compare.length > 0) {
        let missing_str = "";
        for (let c of deck_compare) {
            if (missing_str.length > 0) {
                missing_str = missing_str + "," + c.value + c.suit;
            } else {
                missing_str = c.value + c.suit;
            }
        }
        throw new Error("Missing cards: " + missing_str); 
    }

    return nfboard;
}
