// use electron
const { app, BrowserWindow } = require('electron')

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({ width: 800, height: 600 })

    // and load the index.html of the app.
    win.loadFile('index.html')
}

app.on('ready', createWindow)

// initialize the play button to paused and the animation frame rate
var playPaused = true;
var sval, nframes = 100, frate = 1000;
// define a global variable for the raw json file
// so that it doesn't have to be read in multiple times
var raw;
// tracking variables for offensive and defensive players
var opx, opy, dpx, dpy, qbx, qby, ballx, bally, onums, dnums, opos, dpos, recorder;
var odir, ddir, qbview;
var canvas, context, sizeX, sizeY;
// function to convert yards to pixels
function y2p(value, dim) {
    // convert to positive
    if (dim == 'y') {
        if (raw.playsituation.los > 35) {
            value += raw.playsituation.los + 25 - (raw.playsituation.los - 35)
        } else {
            value += raw.playsituation.los + 25
        }
    } else {
        value += 80 / 3
    }
    // multiply to finish conversion
    value *= 15
    // return value
    return value
}

// function for stopping server
function shutdown() {
    // stop python server
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", "/stopserver", true);
    xhttp.send();
    // close browser tab
    window.close()
}

// function for exporting a pdf Assessment report
function pdfexport() {
    if (document.getElementById("jsonfile") != "") {
        var info = {};
        info['filename'] = document.getElementById("jsonfile").value.replace("C:\\fakepath\\", "");
        // send raw json to the server
        var xhttp = new XMLHttpRequest();
        xhttp.open("POST", "/createpdf", true);
        xhttp.setRequestHeader('Content-Type', 'application/json');
        xhttp.setRequestHeader('Data-Type', 'json');
        xhttp.send(JSON.stringify(info));
    }
}

function playinfotables() {
    if (document.getElementById("jsonfile").value != "") {
        // correct ending
        var ending;
        if (raw.playsituation.down == 1) {
            ending = "st"
        } else if (raw.playsituation.down == 2) {
            ending = "nd"
        } else if (raw.playsituation.down == 3) {
            ending = "rd"
        } else {
            ending = "th"
        }
        // field position
        var fieldpos;
        if (raw.playsituation.los < 0) {
            fieldpos = raw.playsituation.qbteam.abbr + ' ' + (50 + raw.playsituation.los).toString()
        } else {
            fieldpos = raw.playsituation.opponent.abbr + ' ' + (50 - raw.playsituation.los).toString()
        }
        // clock
        var min, sec;
        min = Math.floor(raw.playsituation.clock / 60).toString()
        if (raw.playsituation.clock % 60 < 10) {
            sec = '0' + (raw.playsituation.clock % 60).toString()
        } else {
            sec = (raw.playsituation.clock % 60).toString()
        }
        // game score, clock, quarter, etc. string
        document.getElementById("playdata").innerHTML = raw.playsituation.qbteam.abbr + ' ' +
            raw.playsituation.qbteamscore.toString() + ' ' + raw.playsituation.opponent.abbr + ' ' +
            raw.playsituation.opponentscore.toString() + '  QTR ' + raw.playsituation.quarter.toString() +
            ' ' + min + ':' + sec + '  ' + raw.playsituation.down.toString() + ending + ' & ' +
            raw.playsituation.distance.toString() + ' ' + fieldpos
        // initialize offensive and defensive player ids
        var oids = [], dids = [];
        // identify which players are in the play on offense and defense
        for (var i = 0; i < raw.playerroles.offense.length; i++) {
            oids.push(raw.playerroles.offense[i].playerid)
        }
        for (var k = 0; k < raw.playerroles.defense.length; k++) {
            dids.push(raw.playerroles.defense[k].playerid)
        }
        // access table
        var otable = document.getElementById("opersonnel");
        // loop through players on each team
        for (var j = 0; j < raw.teamroster.offense.length; j++) {
            if (oids.includes(raw.teamroster.offense[j].playerid)) {
                var row = otable.insertRow(-1);
                var cell1 = row.insertCell(0);
                var cell2 = row.insertCell(1);
                var cell3 = row.insertCell(2);
                cell1.innerHTML = raw.teamroster.offense[j].position.name;
                cell2.innerHTML = raw.teamroster.offense[j].jersey;
                cell3.innerHTML = raw.teamroster.offense[j].firstname + " " + raw.teamroster.offense[j].lastname;
            }
        }
        // defensive personnel table
        var dtable = document.getElementById("dpersonnel")
        for (var m = 0; m < raw.teamroster.defense.length; m++) {
            if (dids.includes(raw.teamroster.defense[m].playerid)) {
                var row = dtable.insertRow(-1);
                var cell1 = row.insertCell(0);
                var cell2 = row.insertCell(1);
                var cell3 = row.insertCell(2);
                cell1.innerHTML = raw.teamroster.defense[m].position.name;
                cell2.innerHTML = raw.teamroster.defense[m].jersey;
                cell3.innerHTML = raw.teamroster.defense[m].firstname + " " + raw.teamroster.defense[m].lastname;
            }
        }
        // offensive play information table
        var oplaytable = document.getElementById("oplayt")
        var row = oplaytable.insertRow(-1)
        var cell1 = row.insertCell(0)
        var cell2 = row.insertCell(1)
        cell1.innerHTML = "Formation"
        cell2.innerHTML = raw.playsituation.offplaycall.formation.name
        var row = oplaytable.insertRow(-1)
        var cell1 = row.insertCell(0)
        var cell2 = row.insertCell(1)
        cell1.innerHTML = "Play"
        cell2.innerHTML = raw.playsituation.offplaycall.play.name
        row = oplaytable.insertRow(-1)
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell1.innerHTML = "Play Type"
        cell2.innerHTML = "Pass"
        row = oplaytable.insertRow(-1)
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell1.innerHTML = "Offensive Personnel"
        cell2.innerHTML = raw.playsituation.offplaycall.personnel.name
        row = oplaytable.insertRow(-1)
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell1.innerHTML = "Offensive Basic"
        var countRB = 0, countTE = 0;
        var offids = [];
        for (m = 0; m < raw.playerroles.offense.length; m++) {
            // figure out which roster players are in play
            offids.push(raw.playerroles.offense[m].playerid)
        }
        for (n = 0; n < raw.teamroster.offense.length; n++) {
            if (offids.includes(raw.teamroster.offense[n].playerid)) {
                // if player on roster is in play, check position
                if (raw.teamroster.offense[n].position.name == "RB") {
                    countRB += 1
                } else if (raw.teamroster.offense[n].position.name == "TE") {
                    countTE += 1
                }
            }
        }
        cell2.innerHTML = countRB.toString() + countTE.toString()
        // defensive play information table
        var dplaytable = document.getElementById("dplayt")
        row = dplaytable.insertRow(-1)
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell1.innerHTML = "Play"
        cell2.innerHTML = raw.playsituation.defplaycall.play.name
        row = dplaytable.insertRow(-1)
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell1.innerHTML = "Defensive Personnel"
        cell2.innerHTML = raw.playsituation.defplaycall.personnel.name
        row = dplaytable.insertRow(-1)
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell1.innerHTML = "Defensive Basic"
        var countDL = 0, countLB = 0, countDB = 0;
        var defids = [];
        for (m = 0; m < raw.playerroles.defense.length; m++) {
            // figure out which defensive players are in play
            defids.push(raw.playerroles.defense[m].playerid)
        }
        for (n = 0; n < raw.teamroster.defense.length; n++) {
            // if player on roster is in play, check position
            if (defids.includes(raw.teamroster.defense[n].playerid)) {
                if (raw.teamroster.defense[n].position.name == 'DE') {
                    countDL += 1
                } else if (raw.teamroster.defense[n].position.name == 'DT') {
                    countDL += 1
                } else if (raw.teamroster.defense[n].position.name == 'LB') {
                    countLB += 1
                } else if (raw.teamroster.defense[n].position.name == 'S') {
                    countDB += 1
                } else if (raw.teamroster.defense[n].position.name == 'CB') {
                    countDB += 1
                }
            }
        }
        cell2.innerHTML = countDL.toString() + "-" + countLB.toString() + "-" + countDB.toString()
        // fill in Receiver Route Detail
        throwmetrics();
    }
}

// function for navigating tabs
function openTabs(evt, tabName) {
    // Declare variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // do anything else each individual tab requires
    if (tabName == "playinfo") {
        // fill in tables
        PIreset();
        playinfotables();
    } else if (tabName == "qbperformance") {
        // fill in tables
        QBPreset();
        throwmetrics();
    }

    // Show the current tab, and add an "active" calss to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}
// initialize slider position
// function to work the play/pause button for the slider
function playpause() {
    if (!playPaused) {
        // the video is currently paused
        document.getElementById("playpause").innerHTML = "&#9658";
        playPaused = true;
        clearInterval(sval);
    } else if (playPaused) {
        if (Number(document.getElementById("playslider").value) < nframes - 1) {
            // play from current point
            document.getElementById("playpause").innerHTML = "&#9612&#9612";
            playPaused = false;
            sval = setInterval(function () { moveSlider() }, frate);
        } else {
            // play from beginning
            document.getElementById("playpause").innerHTML = "&#9612&#9612";
            // set slider back to spot 0
            document.getElementById("playslider").value = "0"
            playPaused = false;
            sval = setInterval(function () { moveSlider() }, frate);
        }
    }
}

// function to actually move the slider
function moveSlider() {
    // if the slider has not reached the end
    if (Number(document.getElementById("playslider").value) < nframes - 1) {
        document.getElementById("playslider").value = (Number(document.getElementById("playslider").value) + 1).toString();
    } else {
        document.getElementById("playpause").innerHTML = "&#9658";
        playPaused = true;
        clearInterval(sval);
    }
    // animate players
    animate(Number(document.getElementById("playslider").value));
}

// function to re-draw the image as the slider is moved
function update() {
    var frameid = Number(document.getElementById('playslider').value);
    animate(frameid);
}

function drawfield() {
    // initialize canvas
    var canvas = document.getElementById("field");
    var context = canvas.getContext("2d");
    // plot field
    plot_field();
    function plot_field() {
        fieldim = new Image();
        fieldim.src = 'img/greenField.png';
        // by default, show north end zone through the 25
        var sx = 0, sy = 0, sw = 4045, sh = 9130 * (35 / 120);
        // find los if play exists
        if (document.getElementById("jsonfile").value != "") {
            sy = 9130 * (Math.max(Math.min(-raw.playsituation.los + 35, 120), 0) / 120);
        }
        fieldim.onload = function () {
            context.drawImage(fieldim, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        }
    }
}

function drawall(event) {

    // initialize tab selection
    document.getElementById("defaultOpen").click();

    // re-initialize play animation on field
    var canvas = document.getElementById("players");
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    // re-initialize 2nd layer
    var canvas = document.getElementById("markers");
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    // re-draw field
    var canvas = document.getElementById("field");
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    // read in and parse json
    if (document.getElementById("jsonfile").value != "") {
        var file = event.target.files[0];
        var reader = new FileReader();
        reader.onload = function (event) {
            var data = event.target.result;
            raw = JSON.parse(data);
            // draw field, lines, and formation
            drawfield();
            formation(raw);
            animate(0);
            // fill in session statistics
            sessionstats();
        }
        var data = reader.readAsText(file);

        // reset value of the slider to 0
        document.getElementById("playslider").value = "0"

        // un-hide controls and canvas
        document.getElementById("playpause").style.visibility = "visible";
        document.getElementById("playslider").style.visibility = "visible";
        document.getElementById("field").style.visibility = "visible";
        document.getElementById("markers").style.visibility = "visible";
        document.getElementById("players").style.visibility = "visible";
        document.getElementsByClassName("radio")[0].style.visibility = "visible";
        document.getElementsByClassName("checkboxes")[0].style.visibility = "visible";
        for (k = 0; k < document.getElementsByClassName("block").length; k++) {
            document.getElementsByClassName("block")[k].style.visibility = "visible";
        }
    } else {
        // hide controls and canvas
        document.getElementById("playpause").style.visibility = "hidden";
        document.getElementById("playslider").style.visibility = "hidden";
        document.getElementById("field").style.visibility = "hidden";
        document.getElementById("markers").style.visibility = "hidden";
        document.getElementById("players").style.visibility = "hidden";
        document.getElementsByClassName("radio")[0].style.visibility = "hidden";
        document.getElementsByClassName("checkboxes")[0].style.visibility = "hidden";
        for (k = 0; k < document.getElementsByClassName("block").length; k++) {
            document.getElementsByClassName("block")[k].style.visibility = "hidden";
        }
    }

    // re-initialize Play Information and QB Performance when new play is selected
    PIreset();
    QBPreset();

    // show export to pdf button
    document.getElementById("exportpdf").style.visibility = "visible";
}

function PIreset() {
    // re-initialize Play Information tables
    var nrowo = document.getElementById("opersonnel").rows.length;
    var nrowd = document.getElementById("dpersonnel").rows.length;
    var nrowopc = document.getElementById("oplayt").rows.length;
    var nrowdpc = document.getElementById("dplayt").rows.length;
    var nrowrr = document.getElementById("rrdetail").rows.length;
    if (nrowo > 1) {
        for (var i = 1; i < nrowo; i++) {
            document.getElementById("opersonnel").deleteRow(1);
        }
    }
    if (nrowd > 1) {
        for (var j = 1; j < nrowd; j++) {
            document.getElementById("dpersonnel").deleteRow(1);
        }
    }
    if (nrowopc > 1) {
        for (var i = 1; i < nrowopc; i++) {
            document.getElementById("oplayt").deleteRow(1);
        }
    }
    if (nrowdpc > 1) {
        for (var i = 1; i < nrowdpc; i++) {
            document.getElementById("dplayt").deleteRow(1);
        }
    }
    if (nrowrr > 1) {
        for (var i = 1; i < nrowrr; i++) {
            document.getElementById("rrdetail").deleteRow(1);
        }
    }
}

function QBPreset() {
    // re-initialize QB Performance tables
    var nrowtm = document.getElementById("qbp").rows.length;
    var nrowdd = document.getElementById("dropback").rows.length;
    if (nrowtm > 1) {
        for (var i = 1; i < nrowtm; i++) {
            document.getElementById("qbp").deleteRow(1);
        }
    }
    if (nrowdd > 1) {
        for (var j = 1; j < nrowdd; j++) {
            document.getElementById("dropback").deleteRow(1);
        }
    }
    // clear accuracy canvas
    var canvas = document.getElementById("accuracycanvas");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// function to talk to server and get qb performance metrics
function throwmetrics() {
    if (document.getElementById("jsonfile") != "") {
        // send raw json to the server
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var qbmetrics = this.responseText;
                console.log(qbmetrics)
                // fill in QB performance table
                fillqbp(JSON.parse(qbmetrics));
                // fill in receiver route table
                fillrrt(JSON.parse(qbmetrics));
            }
        };
        xhttp.open("POST", "http://localhost:8081/playcalcs", true);
        xhttp.setRequestHeader('Content-Type', 'application/json');
        xhttp.setRequestHeader('Data-Type', 'json');
        xhttp.send(JSON.stringify(raw));
    }
}

// function to fill in receiver route detail
function fillrrt(metrics) {
    var rrtable = document.getElementById("rrdetail");
    for (var n = 0; n < metrics.Separation.length; n++) {
        row = rrtable.insertRow(-1)
        // create cells
        cell1 = row.insertCell(0)
        cell2 = row.insertCell(1)
        cell3 = row.insertCell(2)
        cell4 = row.insertCell(3)
        cell5 = row.insertCell(4)
        cell6 = row.insertCell(5)
        cell7 = row.insertCell(6)
        // fill in information
        for (var k = 0; k < raw.playerroles.offense.length; k++) {
            if (raw.playerroles.offense[k].playerid == metrics.Separation[n].playerid) {
                for (var j = 0; j < raw.teamroster.offense.length; j++) {
                    if (raw.teamroster.offense[j].playerid == metrics.Separation[n].playerid) {
                        cell1.innerHTML = raw.teamroster.offense[j].jersey;
                        cell2.innerHTML = raw.teamroster.offense[j].firstname + ' ' + raw.teamroster.offense[j].lastname;
                    }
                }
                cell3.innerHTML = raw.playerroles.offense[k].route.name;
                cell4.innerHTML = raw.playerroles.offense[k].route.depth;
                var tsep = 0, msep = 0;
                for (m = 0; m < metrics.Separation[n].sep.length; m++) {
                    tsep += metrics.Separation[n].sep[m]
                    if (metrics.Separation[n].sep[m] > msep) {
                        msep = metrics.Separation[n].sep[m];
                    }
                }
                cell5.innerHTML = Math.round(100 * msep) / 100;
                cell6.innerHTML = Math.round(100 * tsep / metrics.Separation[n].sep.length) / 100;
                if (metrics.IntendedReceiver == metrics.Separation[n].playerid) {
                    cell7.innerHTML = 1;
                } else {
                    cell7.innerHTML = 0;
                }
            }
        }
    }
    // fill in PercIT image
    var canvas = document.getElementById("percitcanvas");
    var ctx = canvas.getContext("2d");
    var image = new Image();
    image.onload = function () {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = metrics.percitimage;
}

// function to fill in QB Performance Tables
function fillqbp(metrics) {
    // fill in Throwing Metrics Table
    var qbtable = document.getElementById("qbp")
    row = qbtable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Velocity"
    cell2.innerHTML = (Math.round(metrics.velocity * 10) / 10).toString() + ' mph'
    row = qbtable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Air Yards"
    cell2.innerHTML = Math.round(metrics.airyards).toString()
    row = qbtable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Air Distance"
    cell2.innerHTML = (Math.round(metrics.airdistance * 10) / 10).toString() + ' yds'
    row = qbtable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Release Height"
    cell2.innerHTML = Math.round(metrics.releaseheight, 0).toString() + ' in'
    row = qbtable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Release Angle"
    cell2.innerHTML = Math.round(metrics.releaseangle).toString() + ' deg'
    // fill in Dropback Detail Table
    var droptable = document.getElementById("dropback")
    row = droptable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Dropback Type"
    cell2.innerHTML = metrics.dropbacktype
    row = droptable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Dropback Depth"
    cell2.innerHTML = (Math.round(metrics.dropbackdepth * 10) / 10).toString() + ' yds'
    row = droptable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Sacked"
    if (metrics.sack) {
        cell2.innerHTML = 'Yes'
    } else {
        cell2.innerHTML = 'No'
    }
    row = droptable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "SackYardage"
    cell2.innerHTML = (Math.round(metrics.sackyardage * 10) / 10).toString() + ' yds'
    row = droptable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Thrown Away"
    if (metrics.thrownaway) {
        cell2.innerHTML = 'Yes'
    } else {
        cell2.innerHTML = 'No'
    }
    row = droptable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Intentional Grounding"
    if (metrics.intentionalgrounding) {
        cell2.innerHTML = 'Yes'
    } else {
        cell2.innerHTML = 'No'
    }
    // plot target accuracy image
    var canvas = document.getElementById("accuracycanvas");
    var ctx = canvas.getContext("2d");
    var image = new Image();
    image.onload = function () {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = metrics.BallPlacementImage;
}

// function to talk to server and calculate session stats
function sessionstats() {
    if (document.getElementById("jsonfile") != "") {
        // find list of files in folder
        var names = document.getElementById("jsonfile").files;
        var fnames = { "files": [] }, pnames = [];
        for (j = 0; j < names.length; j++) {
            fnames["files"].push(names[j].path)
            pnames.push(names[j].name)
        }

        // send list of files in folder to server
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var sessiontotals = this.responseText;
                fillss(JSON.parse(sessiontotals))
            }
        };
        xhttp.open("POST", "http://localhost:8081/totalstats", true);
        xhttp.setRequestHeader('Content-Type', 'application/json');
        xhttp.setRequestHeader('Data-Type', 'json');
        xhttp.send(JSON.stringify(fnames));

        // populate dropdown play selector
        var selector = document.getElementById("selectplay");
        for (var i = 0; i < pnames.length; i++) {
            var el = document.createElement("option");
            el.textContent = pnames[i];
            el.value = pnames[i];
            selector.appendChild(el);
        }
    }
}

// function to fill in session statistics table
function fillss(stats) {
    console.log(stats)
    // box score numbers
    var bsstring = document.getElementById("boxscore");
    bsstring.innerHTML = stats.completions.toString() + '/' + stats.attempts.toString() + ' ' + stats.passyds.toString() +
        ' yds ' + stats.passtd.toString() + ' TD ' + stats.int + ' INT ' + (Math.round(stats.passerrating * 10) / 10).toString() + ' RTG';
    // fill in stats
    var otable = document.getElementById("overall");
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Completion Percentage"
    cell2.innerHTML = (Math.round(1000 * stats.completionpct) / 10).toString() + '%'
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Yards Per Attempt"
    cell2.innerHTML = (Math.round(stats.yardsperattempt * 10) / 10).toString()
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Average Air Yards"
    cell2.innerHTML = (Math.round(stats.avgairyards * 10) / 10).toString()
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Average Air Distance"
    cell2.innerHTML = (Math.round(stats.avgairdistance * 10) / 10).toString() + ' yds'
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Average Time to Throw"
    cell2.innerHTML = (Math.round(stats.avgtimetothrow * 100) / 100).toString() + ' sec'
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Sacks"
    cell2.innerHTML = stats.sacks
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Intentional Grounding"
    cell2.innerHTML = stats.intentionalgrounding
    row = otable.insertRow(-1)
    cell1 = row.insertCell(0)
    cell2 = row.insertCell(1)
    cell1.innerHTML = "Thrown Away"
    cell2.innerHTML = stats.thrownaway
    // fill in By Route
    var brtable = document.getElementById("byroute")
    for (i = 0; i < stats.routedata.length; i++) {
        row = brtable.insertRow(-1);
        for (j = 0; j < stats.routedata[i].length; j++) {
            cell = row.insertCell(-1);
            cell.innerHTML = stats.routedata[i][j];
        }
    }
    // zone image
    var zcanvas = document.getElementById("zonecanvas");
    var zctx = zcanvas.getContext("2d");
    var zimage = new Image();
    zimage.onload = function () {
        zctx.drawImage(zimage, 0, 0, zcanvas.width, zcanvas.height);
    };
    zimage.src = stats.zoneimage;
    // target summary image
    var canvas = document.getElementById("targetsum");
    var ctx = canvas.getContext("2d");
    var image = new Image();
    image.onload = function () {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = stats.targetimage;
}

function formation(raw) {
    // initialize position strings
    opx = [], opy = [], dpx = [], dpy = [], odir = [], ddir = [];
    // calculate time intervals
    var playtime = [];
    for (var i = 0; i < raw.balltrackingdata.length; i++) {
        playtime.push(raw.balltrackingdata[i].sim_time - raw.balltrackingdata[0].sim_time)
    }
    // calculate number of frames and frame rate
    nframes = raw.balltrackingdata.length;
    frate = Math.round(1000 * (playtime[raw.balltrackingdata.length - 1] / nframes));
    document.getElementById("playslider").max = nframes - 1;
    // figure out which players are on offense
    var oids = [];
    for (var i = 0; i < raw.playerroles.offense.length; i++) {
        oids.push(raw.playerroles.offense[i].playerid);
    }
    // calculate offensive player starting locations
    var x, y;
    onums = [], opos = [], rindex = [];
    for (var j = 0; j < raw.playertrackingdata.length; j++) {
        if (oids.includes(raw.playertrackingdata[j].playerid)) {
            // track offensive player numbers
            for (var k = 0; k < raw.teamroster.offense.length; k++) {
                if (raw.teamroster.offense[k].playerid == raw.playertrackingdata[j].playerid) {
                    onums.push(raw.teamroster.offense[k].jersey.toString());
                    opos.push(raw.teamroster.offense[k].position.name);
                }
            }
            // track receiver order
            for (var k = 0; k < raw.playerroles.offense.length; k++) {
                if (raw.playerroles.offense[k].playerid == raw.playertrackingdata[j].playerid) {
                    if (raw.playerroles.offense[k].route != null) {
                        rindex.push([j, -raw.playertrackingdata[j].playertracking[0].rightshoulder.x])
                    }
                }
            }
            // initialize each player tracking
            var onepx = [], onepy = [], onepdir = [];
            for (var k = 0; k < raw.balltrackingdata.length; k++) {
                // calculate average x coordinate and convert to yards
                var x = -(raw.playertrackingdata[j].playertracking[k].rightshoulder.x +
                    raw.playertrackingdata[j].playertracking[k].leftshoulder.x +
                    raw.playertrackingdata[j].playertracking[k].back.x) / 3 / 91.44;
                // calculate average y coordinate and convert to yards
                var y = -(raw.playertrackingdata[j].playertracking[k].rightshoulder.y +
                    raw.playertrackingdata[j].playertracking[k].leftshoulder.y +
                    raw.playertrackingdata[j].playertracking[k].back.y) / 3 / 91.44;
                // calculate player orientation
                var orient = Math.PI + Math.atan2(-(raw.playertrackingdata[j].playertracking[k].rightshoulder.y - raw.playertrackingdata[j].playertracking[k].leftshoulder.y),
                    -(raw.playertrackingdata[j].playertracking[k].rightshoulder.x - raw.playertrackingdata[j].playertracking[k].leftshoulder.x))
                // add to players
                onepx.push(x);
                onepy.push(y);
                onepdir.push(orient);
            }
            // add to arrays
            opx.push(onepx);
            opy.push(onepy);
            odir.push(onepdir);
        }
    }
    // determine order of receivers
    recorder = []
    for (var k = 0; k < rindex.length; k++) {
        var ind = -1, rj = -1, mind = 27 * 91.44;
        for (var j = 0; j < rindex.length; j++) {
            if (rindex[j][1] < mind) {
                mind = rindex[j][1];
                ind = rindex[j][0];
                rj = j;
            }
        }
        // after loop, take minimum index and replace value
        recorder.push(rindex[rj][0])
        rindex[rj][1] = 27 * 91.44
    }
    // figure out which players are on defense
    var dids = [];
    for (var i = 0; i < raw.playerroles.defense.length; i++) {
        dids.push(raw.playerroles.defense[i].playerid);
    }
    // calculate defensive player starting locations
    dnums = [], dpos = [];
    for (var j = 0; j < raw.playertrackingdata.length; j++) {
        if (dids.includes(raw.playertrackingdata[j].playerid)) {
            // track defensive player numbers and roster positions
            for (var k = 0; k < raw.teamroster.defense.length; k++) {
                if (raw.teamroster.defense[k].playerid == raw.playertrackingdata[j].playerid) {
                    dnums.push(raw.teamroster.defense[k].jersey.toString());
                    dpos.push(raw.teamroster.defense[k].position.name);
                }
            }
            // initialize each player tracking
            var onepx = [], onepy = [], onepdir = [];
            for (var k = 0; k < raw.balltrackingdata.length; k++) {
                // calculate average x coordinate and convert to yards
                var x = -(raw.playertrackingdata[j].playertracking[k].rightshoulder.x +
                    raw.playertrackingdata[j].playertracking[k].leftshoulder.x +
                    raw.playertrackingdata[j].playertracking[k].back.x) / 3 / 91.44;
                // calculate average y coordinate and convert to yards
                var y = -(raw.playertrackingdata[j].playertracking[k].rightshoulder.y +
                    raw.playertrackingdata[j].playertracking[k].leftshoulder.y +
                    raw.playertrackingdata[j].playertracking[k].back.y) / 3 / 91.44;
                // calculate player orientation
                var orient = Math.PI + Math.atan2(-(raw.playertrackingdata[j].playertracking[k].rightshoulder.y - raw.playertrackingdata[j].playertracking[k].leftshoulder.y),
                    -(raw.playertrackingdata[j].playertracking[k].rightshoulder.x - raw.playertrackingdata[j].playertracking[k].leftshoulder.x))
                // add to players
                onepx.push(x);
                onepy.push(y);
                onepdir.push(orient);
            }
            // add to arrays
            dpx.push(onepx);
            dpy.push(onepy);
            ddir.push(onepdir)
        }
    }

    // calculate quarterback's position and ball position
    qbx = [], qby = [], ballx = [], bally = [], qbview = [];
    for (var i = 0; i < raw.balltrackingdata.length; i++) {
        // increment to quarterback location
        qbx.push(-raw.qbtrackingdata[i].hmd_location.x / 91.44);
        qby.push(-raw.qbtrackingdata[i].hmd_location.y / 91.44);
        // add to qbview
        if (-raw.qbtrackingdata[i].hmd_direction.x < 0) {
            qbview.push(Math.PI + Math.atan(-raw.qbtrackingdata[i].hmd_direction.y / -raw.qbtrackingdata[i].hmd_direction.x))
        } else {
            qbview.push(Math.atan(-raw.qbtrackingdata[i].hmd_direction.y / -raw.qbtrackingdata[i].hmd_direction.x))
        }
        // add to ball location
        ballx.push(-raw.balltrackingdata[i].simulated_ball.x / 91.44);
        bally.push(-raw.balltrackingdata[i].simulated_ball.y / 91.44);
    }

    // plot initial formation
    animate(0);
}

// function for animation
function animate(frame) {
    // initialize  player canvas
    var canvas = document.getElementById("players");
    var context = canvas.getContext("2d");
    var sizeX = canvas.width / 25;
    var sizeY = canvas.height / 10;
    // clear canvas of previous drawing
    context.clearRect(0, 0, canvas.width, canvas.height)
    // begin animation section
    // plot quarterback
    context.beginPath();
    context.arc(y2p(qbx[frame], 'x'),
        y2p(qby[frame], 'y'),
        sizeX / Math.PI, 0, 2 * Math.PI);
    context.fillStyle = 'yellow'
    context.fill()
    // plot ball
    context.beginPath();
    context.arc(y2p(ballx[frame], 'x'),
        y2p(bally[frame], 'y'),
        sizeX / 2 / Math.PI, 0, 2 * Math.PI);
    context.fillStyle = 'black'
    context.fill()
    // plot offensive points on canvas
    for (var i = 0; i < opx.length; i++) {
        // offensive player locations
        context.beginPath();
        context.arc(y2p(opx[i][frame], 'x'), y2p(opy[i][frame], 'y'), sizeX / Math.PI, 0, 2 * Math.PI);
        context.fillStyle = 'blue'
        context.fill()
        // offensive player directions
        var pxsize = 10;
        context.beginPath();
        context.moveTo(y2p(opx[i][frame], 'x') + Math.round(pxsize * Math.cos(odir[i][frame])), y2p(opy[i][frame], 'y') + Math.round(pxsize * Math.sin(odir[i][frame])))
        context.lineTo(y2p(opx[i][frame], 'x') - Math.round((pxsize + 5) * Math.sin(odir[i][frame])), y2p(opy[i][frame], 'y') + Math.round((pxsize + 5) * Math.cos(odir[i][frame])))
        context.lineTo(y2p(opx[i][frame], 'x') - Math.round(pxsize * Math.cos(odir[i][frame])), y2p(opy[i][frame], 'y') - Math.round(pxsize * Math.sin(odir[i][frame])))
        context.fillStyle = 'blue'
        context.fill()
        if (document.getElementsByName("radgroup")[0].checked) {
            // offensive numbers
            context.font = "20px"
            context.fillStyle = "white"
            context.textAlign = "center"
            context.textBaseline = "middle"
            context.fillText(onums[i], y2p(opx[i][frame], 'x'), y2p(opy[i][frame], 'y'))
        } else if (document.getElementsByName("radgroup")[1].checked) {
            // offensive positions
            context.font = "20px"
            context.fillStyle = "white"
            context.textAlign = "center"
            context.textBaseline = "middle"
            context.fillText(opos[i], y2p(opx[i][frame], 'x'), y2p(opy[i][frame], 'y'))
        }
    }
    // plot defensive points on canvas
    if (!document.getElementById("nodef").checked) {
        for (var j = 0; j < dpx.length; j++) {
            // defensive player locations
            context.beginPath();
            context.arc(y2p(dpx[j][frame], 'x'), y2p(dpy[j][frame], 'y'), sizeX / Math.PI, 0, 2 * Math.PI);
            context.fillStyle = 'red'
            context.fill()
            // defensive player directions
            context.beginPath();
            context.moveTo(y2p(dpx[j][frame], 'x') + Math.round(pxsize * Math.cos(ddir[j][frame])), y2p(dpy[j][frame], 'y') + Math.round(pxsize * Math.sin(ddir[j][frame])))
            context.lineTo(y2p(dpx[j][frame], 'x') - Math.round((pxsize + 5) * Math.sin(ddir[j][frame])), y2p(dpy[j][frame], 'y') + Math.round((pxsize + 5) * Math.cos(ddir[j][frame])))
            context.lineTo(y2p(dpx[j][frame], 'x') - Math.round(pxsize * Math.cos(ddir[j][frame])), y2p(dpy[j][frame], 'y') - Math.round(pxsize * Math.sin(ddir[j][frame])))
            context.fillStyle = 'red'
            context.fill()
            // player labels
            if (document.getElementsByName("radgroup")[0].checked) {
                // defensive numbers
                context.font = "20px"
                context.fillStyle = "white"
                context.textAlign = "center"
                context.textBaseline = "middle"
                context.fillText(dnums[j], y2p(dpx[j][frame], 'x'), y2p(dpy[j][frame], 'y'))
            } else if (document.getElementsByName("radgroup")[1].checked) {
                // defensive positions
                context.font = "20px"
                context.fillStyle = "white"
                context.textAlign = "center"
                context.textBaseline = "middle"
                context.fillText(dpos[j], y2p(dpx[j][frame], 'x'), y2p(dpy[j][frame], 'y'))
            }
        }
    }
    if (document.getElementById("qbviewer").checked) {
        // plot quarterback viewer
        context.beginPath();
        context.moveTo(y2p(qbx[frame], 'x'), y2p(qby[frame], 'y'));
        context.arc(y2p(qbx[frame], 'x'), y2p(qby[frame], 'y'), 100, qbview[frame] - 0.96, qbview[frame] + 0.96);
        context.lineTo(y2p(qbx[frame], 'x'), y2p(qby[frame], 'y'));
        context.fillStyle = "rgba(255,255,255,0.25)"
        context.fill()
    }
    // switch to drawing on middle layer
    var canvas = document.getElementById("markers")
    var context = canvas.getContext("2d")

    // clear current drawing
    context.clearRect(0, 0, canvas.width, canvas.height);

    // plot line of scrimmage
    context.beginPath()
    context.moveTo(0, y2p(-raw.playsituation.los, 'y'))
    context.lineTo(canvas.width, y2p(-raw.playsituation.los, 'y'))
    context.strokeStyle = "#0000FF"
    context.stroke()
    // plot first down marker
    context.beginPath()
    context.moveTo(0, y2p(-raw.playsituation.los - raw.playsituation.distance, 'y'))
    context.lineTo(canvas.width, y2p(-raw.playsituation.los - raw.playsituation.distance, 'y'))
    context.strokeStyle = "#FFFF00"
    context.stroke()

    // check whether to draw defensive play
    if (document.getElementById("defplay").checked) {
        for (i = 0; i < raw.playerroles.defense.length; i++) {
            if (raw.playerroles.defense[i].role.job == "Cover") {
                // Check if man or zone coverage
                if (raw.playerroles.defense[i].role.type == "Zone") {
                    // zone coverage
                    context.beginPath();
                    context.moveTo(y2p(raw.playerroles.defense[i].role.zoneborder.BottomLeft.x, 'x'),
                        y2p(-raw.playerroles.defense[i].role.zoneborder.BottomLeft.y, 'y'));
                    context.lineTo(y2p(raw.playerroles.defense[i].role.zoneborder.BottomLeft.x, 'x'),
                        y2p(-raw.playerroles.defense[i].role.zoneborder.TopRight.y, 'y'));
                    context.lineTo(y2p(raw.playerroles.defense[i].role.zoneborder.TopRight.x, 'x'),
                        y2p(-raw.playerroles.defense[i].role.zoneborder.TopRight.y, 'y'));
                    context.lineTo(y2p(raw.playerroles.defense[i].role.zoneborder.TopRight.x, 'x'),
                        y2p(-raw.playerroles.defense[i].role.zoneborder.BottomLeft.y, 'y'));
                    context.fillStyle = "rgba(0,0,0,0.25)";
                    context.fill();
                    context.beginPath();
                    context.moveTo(y2p(dpx[i][frame], 'x'), y2p(dpy[i][frame], 'y'));
                    context.lineTo(y2p(raw.playerroles.defense[i].role.zoneborder.Landmark.x, 'x'),
                        y2p(-raw.playerroles.defense[i].role.zoneborder.Landmark.y, 'y'));
                    context.strokeStyle = 'orange';
                    context.stroke();
                } else {
                    // man coverage
                    context.beginPath();
                    context.moveTo(y2p(dpx[i][frame], 'x'), y2p(dpy[i][frame], 'y'));
                    context.lineTo(y2p(opx[recorder[raw.playerroles.defense[i].role.recnumber - 1]][frame], 'x'),
                        y2p(opy[recorder[raw.playerroles.defense[i].role.recnumber - 1]][frame], 'y'));
                    context.strokeStyle = 'orange';
                    context.stroke();
                }
            } else {
                // rush QB through gap
                var rushangle = Math.PI / 2, rlen = 25, alen = 5;
                context.beginPath();
                context.moveTo(y2p(dpx[i][frame], 'x'), y2p(dpy[i][frame], 'y'));
                if (dpy[i][frame] < -raw.playsituation.los + 1) {
                    // if you haven't crossed the los, point to a gap
                    if (raw.playerroles.defense[i].role.gap == 'D+') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], 7 - dpx[i][frame]);
                    } else if (raw.playerroles.defense[i].role.gap == 'C+') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], 5 - dpx[i][frame], );
                    } else if (raw.playerroles.defense[i].role.gap == 'B+') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], 3 - dpx[i][frame]);
                    } else if (raw.playerroles.defense[i].role.gap == 'A+') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], 1 - dpx[i][frame]);
                    } else if (raw.playerroles.defense[i].role.gap == 'A-') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], -1 - dpx[i][frame]);
                    } else if (raw.playerroles.defense[i].role.gap == 'B-') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], -3 - dpx[i][frame]);
                    } else if (raw.playerroles.defense[i].role.gap == 'C-') {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], -5 - dpx[i][frame]);
                    } else {
                        rushangle = Math.atan2(-raw.playsituation.los + 1 - dpy[i][frame], -7 - dpx[i][frame]);
                    }
                } else {
                    // if you have crossed, the los, point to QB
                    rushangle = Math.atan2(qby[frame] - dpy[i][frame], qbx[frame] - dpx[i][frame]);
                }
                if (dpy[i][frame] < -raw.playsituation.los - 5) { rlen *= 2 }
                // rush lane
                context.lineTo(y2p(dpx[i][frame], 'x') + rlen * Math.cos(rushangle),
                    y2p(dpy[i][frame], 'y') + rlen * Math.sin(rushangle));
                // arrow
                context.moveTo(y2p(dpx[i][frame], 'x') + rlen * Math.cos(rushangle) - alen * Math.cos(rushangle - Math.PI / 6),
                    y2p(dpy[i][frame], 'y') + rlen * Math.sin(rushangle) - alen * Math.sin(rushangle - Math.PI / 6));
                context.lineTo(y2p(dpx[i][frame], 'x') + rlen * Math.cos(rushangle),
                    y2p(dpy[i][frame], 'y') + rlen * Math.sin(rushangle));
                context.lineTo(y2p(dpx[i][frame], 'x') + rlen * Math.cos(rushangle) - alen * Math.cos(rushangle + Math.PI / 6),
                    y2p(dpy[i][frame], 'y') + rlen * Math.sin(rushangle) - alen * Math.sin(rushangle + Math.PI / 6));
                context.strokeStyle = 'orange';
                context.stroke();
            }
        }
    }
    // check whether to draw offensive play
    if (document.getElementById("offplay").checked) {
        // draw routes and blocking
        for (i = 0; i < raw.playerroles.offense.length; i++) {
            if (raw.playerroles.offense[i].route != null) {
                // draw route
                context.beginPath();
                context.moveTo(y2p(opx[i][0], 'x'), y2p(opy[i][0], 'y'));
                var cx = opx[i][0], cy = opy[i][0];
                for (var j = 0; j < raw.playerroles.offense[i].route.directions.length; j++) {
                    context.lineTo(y2p(cx + raw.playerroles.offense[i].route.directions[j][1] * Math.cos(raw.playerroles.offense[i].route.directions[j][0]), 'x'),
                        y2p(cy - raw.playerroles.offense[i].route.directions[j][1] * Math.sin(raw.playerroles.offense[i].route.directions[j][0]), 'y'));
                    // update current position
                    cx = cx + raw.playerroles.offense[i].route.directions[j][1] * Math.cos(raw.playerroles.offense[i].route.directions[j][0])
                    cy = cy - raw.playerroles.offense[i].route.directions[j][1] * Math.sin(raw.playerroles.offense[i].route.directions[j][0])
                }
                context.strokeStyle = 'blue';
                context.stroke();
            } else {
                // draw blocking assignment
                var blockstem = 10, blockwidth = 5;
                context.beginPath();
                context.moveTo(y2p(opx[i][0], 'x'), y2p(opy[i][0], 'y'));
                if (raw.playerroles.offense[i].block.name == "Center Forward") {
                    // Center Forward
                    context.lineTo(y2p(opx[i][0], 'x'), y2p(opy[i][0], 'y') - blockstem);
                    context.moveTo(y2p(opx[i][0], 'x') - blockwidth, y2p(opy[i][0], 'y') - blockstem);
                    context.lineTo(y2p(opx[i][0], 'x') + blockwidth, y2p(opy[i][0], 'y') - blockstem);
                } else if (raw.playerroles.offense[i].block.name == "Right Forward") {
                    // Right Forward
                    context.lineTo(y2p(opx[i][0], 'x') + blockstem * Math.cos(Math.PI / 4), y2p(opy[i][0], 'y') - blockstem * Math.sin(Math.PI / 4));
                    context.moveTo(y2p(opx[i][0], 'x') + blockstem * Math.cos(Math.PI / 4) - blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') - blockstem * Math.sin(Math.PI / 4) - blockwidth * Math.sin(Math.PI / 4));
                    context.lineTo(y2p(opx[i][0], 'x') + blockstem * Math.cos(Math.PI / 4) + blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') - blockstem * Math.sin(Math.PI / 4) + blockwidth * Math.sin(Math.PI / 4));
                } else if (raw.playerroles.offense[i].block.name == "Left Forward") {
                    // Left Forward
                    context.lineTo(y2p(opx[i][0], 'x') - blockstem * Math.cos(Math.PI / 4), y2p(opy[i][0], 'y') - blockstem * Math.sin(Math.PI / 4));
                    context.moveTo(y2p(opx[i][0], 'x') - blockstem * Math.cos(Math.PI / 4) - blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') - blockstem * Math.sin(Math.PI / 4) + blockwidth * Math.sin(Math.PI / 4));
                    context.lineTo(y2p(opx[i][0], 'x') - blockstem * Math.cos(Math.PI / 4) + blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') - blockstem * Math.sin(Math.PI / 4) - blockwidth * Math.sin(Math.PI / 4));
                } else if (raw.playerroles.offense[i].block.name == "Right Backward") {
                    // Right Backward
                    context.lineTo(y2p(opx[i][0], 'x') + blockstem * Math.cos(Math.PI / 4), y2p(opy[i][0], 'y') + blockstem * Math.sin(Math.PI / 4));
                    context.moveTo(y2p(opx[i][0], 'x') + blockstem * Math.cos(Math.PI / 4) - blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') + blockstem * Math.sin(Math.PI / 4) + blockwidth * Math.sin(Math.PI / 4));
                    context.lineTo(y2p(opx[i][0], 'x') + blockstem * Math.cos(Math.PI / 4) + blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') + blockstem * Math.sin(Math.PI / 4) - blockwidth * Math.sin(Math.PI / 4));
                } else if (raw.playerroles.offense[i].block.name == "Left Backward") {
                    // Left Backward
                    context.lineTo(y2p(opx[i][0], 'x') - blockstem * Math.cos(Math.PI / 4), y2p(opy[i][0], 'y') + blockstem * Math.sin(Math.PI / 4));
                    context.moveTo(y2p(opx[i][0], 'x') - blockstem * Math.cos(Math.PI / 4) - blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') + blockstem * Math.sin(Math.PI / 4) - blockwidth * Math.sin(Math.PI / 4));
                    context.lineTo(y2p(opx[i][0], 'x') - blockstem * Math.cos(Math.PI / 4) + blockwidth * Math.cos(Math.PI / 4),
                        y2p(opy[i][0], 'y') + blockstem * Math.sin(Math.PI / 4) + blockwidth * Math.sin(Math.PI / 4));
                } else {
                    // Center Backward
                    context.lineTo(y2p(opx[i][0], 'x'), y2p(opy[i][0], 'y') + blockstem);
                    context.moveTo(y2p(opx[i][0], 'x') - blockwidth, y2p(opy[i][0], 'y') + blockstem);
                    context.lineTo(y2p(opx[i][0], 'x') + blockwidth, y2p(opy[i][0], 'y') + blockstem);
                }
                context.strokeStyle = 'blue';
                context.stroke();
            }
        }
    }
}