// --- VIEW ---

function update_text_view () {
    reset_editing_text_area();
    let text_area = document.getElementById("text_game");
    let game_str = "";

    function case_padding (case_str) {
        let ret = case_str;
        for (let ci = case_str.length; ci < 4; ci++) {
            ret += " ";
        }
        return ret;
    }

    // freecells
    for (let i=0; i<4; i++) {
        let cstr = "";
        if (fcboard.freecells[i]) {
            let c = fcboard.freecells[i];
            cstr += c.value + c.suit;
        }
        game_str += case_padding(cstr);
    }

    // Bases
    for (let i=0; i<4; i++) {
        let cstr = "";
        if (fcboard.bases[i].length > 0) {
            let c = fcboard.bases[i][fcboard.bases[i].length - 1];
            cstr += c.value + c.suit;
        } else {
            cstr += "0X"
        }
        game_str += case_padding(cstr);
    }
    game_str += "\n\n";

    // Columns
    let i = 0;
    let cols_done = [];
    while (cols_done.length < 8) {
        
        for (let j=0; j<8; j++) {
            let cstr = "  ";
            if (!cols_done.includes(j)) {
                let col = fcboard.columns[j];
                if (i < col.length) {
                    cstr = col[i].value + col[i].suit;
                } else {
                    cols_done.push(j);
                }
            }
            game_str += case_padding(cstr);
        }
        i += 1;
        game_str += "\n";
    }

    text_area.value = game_str;
}

var editing = false;
function edit_game () {
    let edit_button = document.getElementById("edit_game");
    let text_area = document.getElementById("text_game");

    if (!editing) {
        edit_button.innerHTML = "Save";
        text_area.removeAttribute("readonly");
        text_area.style.backgroundColor = "#ffffff";
        editing = true;
        return;
    }

    try {
        fcboard = create_from_string(text_area.value);
        document.getElementById("solve_area").value = ">";
        document.getElementById("moves_number").innerHTML = "0";
        replace_cards();
        reset_editing_text_area();
    } catch (error) {
        text_area.classList.add("wrong_field");
        document.getElementById("err_msg").innerHTML = error;
        document.getElementById("editing_error").showModal();
    }
}

function reset_editing_text_area () {
    let edit_button = document.getElementById("edit_game");
    let text_area = document.getElementById("text_game");
    text_area.classList.remove("wrong_field");
    edit_button.innerHTML = "Edit";
    text_area.setAttribute("readonly", "true");
    text_area.style.backgroundColor = "#f5f5f5";
    editing = false;
}

function scroll_solve_area (pos_coeff) {
    let sa = document.getElementById("solve_area");
    sa.scrollTop = pos_coeff * sa.scrollHeight;
}

function update_view () {

    // clear all cards
    for (let c of document.getElementsByClassName("card")) {
        c.classList.remove("draggable");
        c.style.transition = "";
    }

    // Add draggable class to cards
    if (fcboard) {
        for (let c of fcboard.get_movable_cards()) {
            c.getHtmlElement().classList.add("draggable");
        }
    }
}

function getGameAreaOffsetPosition(el) {
    let top = 0, left = 0;
    while (el !== document.getElementById("game_area")) {
        top += el.offsetTop;
        left += el.offsetLeft;
        el = el.offsetParent;
    }
    return {top, left};
}

function replace_cards () {

    if (!fcboard) {
        return;
    }

    update_text_view();
    update_view();

    // -- Update cards position --
    // freecells
    for (let i=0; i<4; i++) {
        let fcpos = getGameAreaOffsetPosition(document.getElementById("freecell_"+i));
        if (fcboard.freecells[i]) {
            let chtml = fcboard.freecells[i].getHtmlElement();
            chtml.style.top = fcpos.top + 'px';
            chtml.style.left = fcpos.left + 'px';
            chtml.style.zIndex = 1;
        }
    }

    // Bases
    for (let i=0; i<4; i++) {
        let basepos = getGameAreaOffsetPosition(document.getElementById("base_"+i));
        let zind = 1;
        for (let cb of fcboard.bases[i]) {
            let chtml = cb.getHtmlElement();
            chtml.style.top = basepos.top + 'px';
            chtml.style.left = basepos.left + 'px';
            chtml.style.zIndex = zind;
            zind += 1;
        }
    }

    // Columns
    for (let i=0; i<8; i++) {
        let colpos = getGameAreaOffsetPosition(document.getElementById("col_"+i));
        let itery = colpos.top;
        let zind = 1;
        for (let cc of fcboard.columns[i]) {
            let chtml = cc.getHtmlElement();
            chtml.style.top = itery + 'px';
            itery += 40;
            chtml.style.left = colpos.left + 'px';
            chtml.style.zIndex = zind;
            zind += 1;
        }
    }
}

var scale_value = 1;
var menu_on_side = true;
function resize() {

    let game_area = document.getElementById('game_area');
    let main_menu = document.getElementById('main_menu');
    let ga_margin_top = window.getComputedStyle(game_area).getPropertyValue('margin-top').split('px')[0] * 1;
    let min_side = Math.min(window.innerHeight - ga_margin_top, window.innerWidth);

    if (min_side < 1200) {
        scale_value = min_side/1200;
    } else {
        scale_value = 1;
    }

    let menu_width = 3*document.getElementById("top_menu_span").clientWidth; //around 330px
    let ga_w = (window.innerWidth - menu_width)/scale_value;
    if (ga_w < 1100) {
        // missing the 330px for the menu on the side, moving menu down
        menu_on_side = false;
        ga_w = (window.innerWidth - 16)/scale_value;
    } else {
        // move menu back on side
        menu_on_side = true;
    }

    let left_move = 0; // reset center position
    if (ga_w > 1500) {
        ga_w = 1500;
        // move to center (w & wo menu on side)
        let tot_w = ga_w*scale_value;
        if (menu_on_side) { tot_w += menu_width }
        left_move = (window.innerWidth - tot_w)/2;
    }
    game_area.style.left = left_move + "px";
    game_area.style.width = ga_w + 'px';
    
    game_area.style.transform = ""; // reset transform
    game_area.style.marginBottom = "";
    if (scale_value < 1) {
        let translateY = (game_area.clientHeight * (1-scale_value))/(2*scale_value);
        let translateX = (game_area.clientWidth * (1-scale_value))/(2*scale_value);
        game_area.style.transform = "scale(" + scale_value + ") translate(-" + translateX + "px, -" + translateY + "px)";
        game_area.style.marginBottom = -(game_area.clientHeight * (1-scale_value)) + 'px';
    }
    
    // update menu position
    let main_menu_left = 25 + left_move + (ga_w*scale_value);
    if (menu_on_side) {
        main_menu.classList.remove("on_bottom");
        main_menu.classList.add("on_side");
        document.getElementsByTagName("body")[0].style.overflow = "hidden";

        document.getElementById("solve_area").style.minHeight = 0;
        document.getElementById("top_menu_shadow").style.minHeight = "4em";

        // game id section
        let tms = document.getElementById("top_menu_span")
        let tms_width = tms.clientWidth + (window.getComputedStyle(tms).getPropertyValue('margin-left').split('px')[0] * 2);
        document.getElementById("game_id_section").style.marginLeft = main_menu_left-tms_width + "px";
        document.getElementById("top_menu").style.justifyContent = "";

    } else {
        main_menu_left = 0;
        main_menu.classList.remove("on_side");
        main_menu.classList.add("on_bottom");
        document.getElementsByTagName("body")[0].style.overflow = "auto";

        document.getElementById("solve_area").style.minHeight = "300px";
        document.getElementById("top_menu_shadow").style.minHeight = "1em";

        // game id section
        document.getElementById("game_id_section").style.marginLeft = "20px";
        document.getElementById("top_menu").style.justifyContent = "space-between";
    }
    main_menu.style.left = main_menu_left + "px";

    // edit section margin
    let edit_section_margin = (document.getElementById("main_menu").clientWidth - document.getElementById("edit_section").clientWidth)/2;
    document.getElementById("edit_section").style.marginLeft = edit_section_margin + "px";

    replace_cards();
}
window.addEventListener('resize', resize, false);

function update_moves_area (additional_msg) {
    let solve_area_value = "";
    for (let i = 0; i < fcboard.moves.length; i++) {
        let b = fcboard.moves.length - i;
        if (b == fcboard.back_count) {
            solve_area_value += "> ";
            if (additional_msg) {
                solve_area_value += additional_msg;
            }
        }
        solve_area_value += fcboard.moves[i].to_string();
        solve_area_value += "\n";
    }
    if (fcboard.back_count == 0) {
        solve_area_value += "> ";
        if (additional_msg) {
            solve_area_value += additional_msg;
        }
    }
    document.getElementById("solve_area").value = solve_area_value;
    
    // scroll
    if (additional_msg && fcboard.back_count == 0) {
        scroll_solve_area(1);
    } else {
        let bc = fcboard.back_count+3;
        scroll_solve_area((fcboard.moves.length-bc)/fcboard.moves.length);
    }

    // Moves count
    document.getElementById("moves_number").innerText = fcboard.moves.length.toString();
}


// ----- UI Move functions -----

// Stop scroll on touch screen
function prevDef(e) {
    e.preventDefault();
}
// modern Chrome requires { passive: false } when adding event
let supportsPassive = false;
try {
  window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
    get: function () { supportsPassive = true; } 
  }));
} catch(e) {}
let scrollOpt = supportsPassive ? { passive : false } : false;

function disableScroll() {
    window.addEventListener('touchmove', prevDef, scrollOpt);
}
function enableScroll() {
    window.removeEventListener('touchmove', prevDef, scrollOpt);
}

let global_moving = false;

async function view_move_cards (cards, dest_id, model_move, fast) {
    /*
      move cards to dest
    */
    
    dest_pos = getGameAreaOffsetPosition(document.getElementById(dest_id));
    if (dest_id.includes("card")) { dest_pos.top += 40; }
    dest_pos.z = (document.getElementById(dest_id).style.zIndex*1) + 1;
    if (dest_id.includes("base")) {
        dest_pos.z = cards[0].value_num + 1;
    }

    let transi = "left 0.5s ease 0s, top 0.5s ease 0s";
    let transi_to = 500;
    if (fast) {
        transi = "left 0.3s ease 0s, top 0.3s ease 0s";
        transi_to = 300;
    }

    // move to destination
    let itery = dest_pos.top;
    let zind = 100;
    for (let c of cards) {
        let thtml = c.getHtmlElement();
        thtml.style.left = dest_pos.left + 'px';
        thtml.style.top = itery + 'px';
        itery += 40;
        thtml.style.zIndex = zind;
        zind += 1;
        thtml.style.transition=transi;
    }

    let move_done = new Promise (function(resolve) {
        if (model_move) {
            fcboard.apply_move(model_move);
            fcboard.update_mvt_max();

            // Update Move list
            update_moves_area();
        }
        update_text_view();
        setTimeout(() => {
            // change zIndex
            let zind = dest_pos.z;
            for (let c of cards) {
                c.getHtmlElement().style.zIndex = zind;
                zind += 1;
            }
            // update grabable cards
            update_view();

            // Show status popup
            let state = fcboard.get_board_status();
            if (state == "WIN") {
                document.getElementById("win_popup").showModal();
            } else if (state == "GAMEOVER") {
                document.getElementById("lose_popup").showModal();
            }

            // reset moving var
            global_moving = false;
            resolve();
         }, transi_to);
    });
    await move_done;
}

function drag(e) {
    let target = e.target;

    if (global_moving || !target.classList.contains("draggable") || !fcboard) {
        return;
    }
    reset_clue();
    global_moving = true;
    target.style.cursor = "grabbing";
    target.moving = true;

    // Disable scroll on touch screen
    disableScroll();

    // gets list of card to move & list of possible destination from fcboard
    target_data = fcboard.get_card_target(target.id);

    // get old left and top position for all moving cards and up zInd
    let zind = 100;
    for (let t of target_data.moving_cards) {
        let thtml = t.getHtmlElement();
        thtml.style.transition = "";
        thtml.style.zIndex = zind;
        zind += 1;

        if (e.clientX) { // Mouse
            thtml.oldX = e.clientX;
            thtml.oldY = e.clientY;
        } else { // Touch
            thtml.oldX = e.touches[0].clientX;
            thtml.oldY = e.touches[0].clientY;
        }

        thtml.oldLeft = window.getComputedStyle(thtml).getPropertyValue('left').split('px')[0] * 1;
        thtml.oldTop = window.getComputedStyle(thtml).getPropertyValue('top').split('px')[0] * 1;
    }

    // follow mouse function
    document.onmousemove = dr;
    document.ontouchmove = dr;
    function dr(event) {
        if (!target.moving) {
            return;
        }
        if (event.clientX) { // mouse
            event.preventDefault();
        }
    
        for (let t of target_data.moving_cards) {
            let thtml = t.getHtmlElement();
            if (event.clientX) { // Mouse
                thtml.distX = event.clientX - thtml.oldX;
                thtml.distY = event.clientY - thtml.oldY;
            } else { // Touch
                thtml.distX = event.touches[0].clientX - thtml.oldX;
                thtml.distY = event.touches[0].clientY - thtml.oldY;
            }

            thtml.style.left = thtml.oldLeft + (1/scale_value)*thtml.distX + "px";
            thtml.style.top = thtml.oldTop + (1/scale_value)*thtml.distY + "px";
        }
    }

    function endDrag(event) {
        if (!target.moving) {
            return;
        }
        if (event.clientX) { // mouse
            event.preventDefault();
        } else {
            enableScroll();
        }
        

        target.style.cursor = "";
        target.moving = false;
        
        // init dest to 1st target when possible
        let dest = target_data.origin;
        if (target_data.targets.length > 0) {
            dest = target_data.targets[0];
        }
        
        // find underlying target
        for (let t of target_data.targets) {
            let n_dest_pos = getGameAreaOffsetPosition(document.getElementById(t));
            n_dest_pos.right = n_dest_pos.left + document.getElementById(t).offsetWidth;
            n_dest_pos.bottom = n_dest_pos.top + document.getElementById(t).offsetHeight;

            let eventX = 0;
            let eventY = 0;
            if (event.clientX) { // mouse
                eventX = event.clientX;
                eventY = event.clientY;
            } else { // touch
                eventX = event.changedTouches[0].clientX;
                eventY = event.changedTouches[0].clientY;
            }

            let x = (eventX-document.getElementById("game_area").offsetLeft)/scale_value;
            let y = (eventY-document.getElementById("game_area").offsetTop)/scale_value;
            if (x >= n_dest_pos.left && x <= n_dest_pos.right
                && y >= n_dest_pos.top && y <= n_dest_pos.bottom) {
                dest = t;
                break;
            }
        }
        
        let model_move = null;
        if (dest != target_data.origin) {
            model_move = fcboard.new_move(target_data.moving_cards, dest);
        }
        view_move_cards(target_data.moving_cards, dest, model_move, false);
    }
    target.onmouseup = endDrag;
    target.parentElement.onmouseleave = endDrag;
    target.ontouchend = endDrag;
    target.ontouchcancel = endDrag;
}
document.onmousedown = drag;
document.ontouchstart = drag;

function undo() {
    if (global_moving || !fcboard) {
        return;
    }
    reset_clue();
    
    let m = fcboard.move_backward();
    if (m) {
        global_moving = true;
        view_move_cards(m.cards, m.dest_view_id, m, true);
    }
}

function redo() {
    if (global_moving || !fcboard) {
        return;
    }
    reset_clue();
    
    let m = fcboard.move_forward();
    if (m) {
        global_moving = true;
        view_move_cards(m.cards, m.dest_view_id, m, true);
    }
}

async function auto_base() {
    if (global_moving || !fcboard) {
        return;
    }
    reset_clue();

    let cont = true;
    while (cont) {
        cont = false;

        // freecells
        for (let i = 0; i < fcboard.freecells.length; i++) {
            let f = fcboard.freecells[i];
            if (f) {
                let b = fcboard.good_for_base(f);
                if (b >= 0) {
                    global_moving = true;
                    let m = fcboard.new_move([f], "base_" + b);
                    await view_move_cards(m.cards, m.dest_view_id, m, true);
                    cont = true;
                    break;
                } 
            }
        }
        if (cont) continue;

        // columns
        for (let col of fcboard.columns) {
            if (col.length > 0) {
                let b = fcboard.good_for_base(col[col.length-1]);
                if (b >= 0) {
                    global_moving = true;
                    let m = fcboard.new_move(col.slice(-1), "base_" + b);
                    await view_move_cards(m.cards, m.dest_view_id, m, true);
                    cont = true;
                    break;
                }
            }
        }
    }

}

var auto_playing = false;
async function play_backward() {
    if (auto_playing || global_moving || !fcboard) {
        return;
    }
    reset_clue();

    auto_playing = true;
    while (auto_playing) {
        let m = fcboard.move_backward();
        if (m) {
            global_moving = true;
            await view_move_cards(m.cards, m.dest_view_id, m, true);
        } else {
            auto_playing = false;
        }
    }
}

async function play_forward() {
    if (auto_playing || global_moving || !fcboard) {
        return;
    }
    reset_clue();

    auto_playing = true;
    while (auto_playing) {
        let m = fcboard.move_forward();
        if (m) {
            global_moving = true;
            await view_move_cards(m.cards, m.dest_view_id, m, true);
        } else {
            auto_playing = false;
        }
    }
}

async function pause() {
    if (auto_playing) {
        auto_playing = false;
    }
}

// --- Solve function ---

function iter_solve (solver) {
    return new Promise((ended) => {
        res = solver.solve();
        setTimeout(() => {
            ended(res);
        }, 10);
    });
}

function reduce (solver, solution) {
    return new Promise((ended) => {
        nmoves = solver.moves_reducer(solution);
        ended(nmoves);
    });
}

async function solve() {
    if (auto_playing || global_moving || !fcboard) {
        return;
    }
    reset_clue();
    global_moving = true;

    fcboard.discard_futur_moves();
    let solve_msg = "\n\nSolving:\n"
    update_moves_area(solve_msg);

    let res = {"success": false};
    let solv = new Solver(fcboard);
    let solvable = true;
    while (!res.success && solvable) {
        solve_msg += "iter " + (solv.called+1).toString() + "...\n";
        update_moves_area(solve_msg);
        res = await iter_solve(solv).catch((err) => {
            console.log(err);
            solvable = false;
            return {"success": false};
        });
    }

    if (res.success) {
        solve_msg += "found in " + res.moves.length.toString() + " more moves\n";
        
        update_moves_area(solve_msg);
        solution = await reduce(solv, res.moves);
        solve_msg += "reduce to " + solution.length.toString() + " moves\n\n";

        // update moves list
        fcboard.moves.push(...solution);
        fcboard.back_count = solution.length;
    } else {
        solve_msg += "no solution found\n";
    }
    update_moves_area(solve_msg);
    
    global_moving = false;
}

//----- Clue -----
var clue_timeout = undefined;
async function give_clue() {
    if (auto_playing || global_moving || !fcboard) {
        return;
    }

    clearTimeout(clue_timeout);
    reset_clue();
    
    let solv = new Solver(fcboard);
    let choices = solv.game.list_choices();

    if (choices.length == 0) {
        return;
    }
    
    solv.sort_choices(choices, false);

    fcboard.clue_iter = fcboard.clue_iter + 1;
    if (fcboard.clue_iter > choices.length) {
        fcboard.clue_iter = 1;
    }
    let m = choices[choices.length-fcboard.clue_iter];
    
    let orig = document.getElementById(m.cards[0].id_str);
    let dest = document.getElementById(m.dest_view_id);

    orig.classList.add('clue');
    dest.classList.add('clue');

    clue_timeout = setTimeout(reset_clue, 1200);
}

function reset_clue() {
    let elements_with_clue = Array.from(document.getElementsByClassName('clue'));
    for (let e of elements_with_clue) {
        e.classList.remove('clue');
    }
}

/*
difficult:
2JL02
AGHDO

impossible game:
aH  aS  4H  aC  2D  6S  10S jS  
3D  3H  qS  qC  8S  7H  aD  kS  
kD  6H  5S  4D  9H  jH  9S  3C  
jC  5D  5C  8C  9D  10D kH  7C  
6C  2C  10H qH  6D  10C 4S  7S  
jD  7D  8H  9C  2H  qD  4C  5H  
kC  8D  2S  3S  
*/