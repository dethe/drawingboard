// Copyright (C) 2020 Dethe Elza

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/* globals GIF
           getAnimationBBox 
           gotoFirstFrame gotoLastFrame incrementFrame decrementFrame
           key */
import * as file from "./file.js";
import { state } from "./state.js";
import { ui } from "./ui.js";
import * as frames from "./frames.js";
import * as tool from "./tool.js";
import * as dom from "./dom.js";
const { $, $$, listen } = dom;
import * as animation from "./animation.js";
import SVGCanvas from "./svgcanvas.js";
import * as stepper from "./stepper.js";
import * as undo from "./undo.js";

for (const val in state){
  console.log("%s => %s", val, state[val]);
}

const mouse = {};

const defaultCanvas = `<svg id="canvas" width="2560px" height="1116px" data-name="untitled" data-tool="pen" data-stroke-width="2" data-do-onionskin="true" data-fps="10" data-palette="0" data-color="#000000" data-bgcolor="#FFFFFF" data-color1="#FF0000" data-color2="#FFFF00" data-color3="#00FF00" data-color4="#00FFFF" data-color5="#0000FF" data-color6="#666666" data-color7="#000000" data-color8="#FFFFFF" data-tab_file="false" data-tab_draw="true" data-tab_frames="true" data-tab_animate="false"><g class="frame selected"></g></svg>`;


function getSvgPoint(x, y) {
  let point = $("svg").createSVGPoint();
  point.x = x;
  point.y = y;
  return point;
}

let tools = {
  pen: new tool.Pen(ui.canvas),
  move: new tool.Move(ui.canvas),
  rotate: new tool.Rotate(ui.canvas),
  zoomin: new tool.ZoomIn(ui.canvas),
  zoomout: new tool.ZoomOut(ui.canvas),
  eraser: new tool.Eraser(ui.canvas),
};
let currentTool;
selectTool("pen");

function selectToolHandler(sel) {
  selectTool(sel.value);
}

function selectTool(name) {
  currentTool = tools[name];
  state.tool = name;
  currentTool.select();
}

// Prevent control clicks from passing through to svg
function swallowClicks(evt) {
  evt.stopPropagation();
  // evt.preventDefault();
}
listen(".toolbar, .tabbar", ["mousedown", "touchstart"], swallowClicks);

const toolStart = evt => currentTool.start(evt);
const toolMove = evt => currentTool.move(evt);
const toolStop = evt => currentTool.stop(evt);
const toolCancel = evt => currentTool.cancel();
const escCancel = evt => {
  if (evt.code && evt.code === "Escape") {
    currentTool.cancel();
  }
};

let body = document.body;

function listenCanvas() {
  listen(canvas, ["mousedown", "touchstart"], toolStart);
  listen(canvas, ["mousemove", "touchmove"], toolMove);
  listen(canvas, "touchend", toolStop);
  listen(canvas, "touchcancel", toolCancel);
}

listen(body, "mouseup", toolStop);
listen(body, "keydown", escCancel);

function undoLine() {
  dom.remove(ui.currentFrame().lastElementChild);
}


/* FILE Functions */

function newAnimation(evt) {
  let forSure = confirm(
    "This will delete your current document, be sure to save first. Delete and start a new document?"
  );
  if (forSure){
    clear();
    ui.updateFrameCount();
    undo.clear();
  }
}

function restoreFormat(savetext) {
  if (!savetext) {
    savetext = defaultCanvas;
  }
  ui.canvas.outerHTML = savetext;
  ui.canvas = $("#canvas");
  ui.updateFrameCount();
  ui.resize();
  restoreSavedState();
  listenCanvas();
}

function restoreLocal() {
  restoreFormat(localStorage._currentWork || defaultCanvas);
}

function clear() {
  restoreFormat(defaultCanvas);
}

function saveToMoat() {
  let moat = $("#moat");
  if (!moat.value) {
    alert("You have to choose a Moat program first");
    return;
  }
  if (!state.name) {
    state.name = prompt("Save SVG file as: ");
  }
  if (!state.name){
    return;
  }
  file.sendToMoat(saveFormat(), `${state.name}.svg`, moat.value);
}

function saveFormat() {
  if (ui.canvas) {
    updateSavedState();
    return ui.canvas.outerHTML;
  } else {
    return "";
  }
}

function saveAsSvg(evt) {
  evt.preventDefault();
  if (!state.name || state.name === 'untitled') {
    state.name = prompt("Save SVG file as: ");
  }
  if (!state.name) return;
  file.save(saveFormat(), state.name);
}

function saveFrameAsPng(evt) {
  let { x, y, width, height } = getAnimationBBox();
  let img = frameToImage(ui.currentFrame(), x, y, width, height);
  // FIXME: save the image
}

function saveAsGif(evt) {
  if (!state.name || state.name === 'untitled') {
    state.name = prompt("Save SVG file as: ");
  }
  if (!state.name) return;
  let gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: "lib/gif.worker.js",
    background: $("#backgroundcolor").value,
  });
  let images = animationToImages();
  images.forEach(img => gif.addFrame(img, { delay: state.frameDelay }));
  gif.on("finished", function (blob) {
    console.info("gif completed");
    file.saveAs(blob, `${state.name}.gif`);
    window.open(URL.createObjectURL(blob));
  });
  gif.render();
}

function openSvg(evt) {
  file.load(restoreFormat);
}

function frameToImage(frame, x, y, width, height, callback) {
  let c = new SVGCanvas(frame, x, y, width, height);
  return c.canvas;
}

function toggleDisplay(evt) {
  evt.preventDefault();
  evt.stopPropagation();
  if (currentDisplay === "drawingboard") {
    currentDisplay = "storyboard";
    displayAsStoryboard();
  } else {
    currentDisplay = "drawingboard";
    displayAsDrawingboard();
  }
}

function animationToImages() {
  let { x, y, width, height } = getAnimationBBox();
  return Array.from($$(".frame")).map(frame =>
    frameToImage(frame, x, y, width, height)
  );
}

function saveAsSpritesheet() {
  if (!state.name || state.name === 'untitled') {
    state.name = prompt("Save PNG file as: ");
  }
  if (!state.name) return;
  let { x, y, width, height } = getAnimationBBox();
  let frames = $$(".frame");
  let canvas = dom.html("canvas", {
    width: width,
    height: height * frames.length
  });
  let ctx = canvas.getContext("2d");
  frames.forEach((frame, idx) => {
    ctx.drawImage(frameToImage(frame, x, y, width, height), 0, height * idx);
  });
  file.saveAs(canvas, `${state.name}.png`);
}

function saveLocal() {
  localStorage._currentWork = saveFormat();
}

function updateSavedState() {
  for (let key in state) {
    ui.canvas.dataset[key] = values[key];
  }
}

function restoreSavedState() {
  for (let key in ui.canvas.dataset) {
    if (Object.keys(state).includes(key)){
      state[key] = ui.canvas.dataset[key];
    }
  }
}

function displayAsStoryboard() {
  let frames = animationToImages();
  frames.forEach(f => document.body.appendChild(f));
  document.body.classList.add("storyboard");
  canvas.style.display = "none";
}

function displayAsDrawingboard() {
  Array.from($$(".storyboard-frame")).map(f => f.remove());
  document.body.classList.remove("storyboard");
  canvas.style.display = "block";
}

function keydownHandler(evt) {
  if ((evt.key || evt.keyIdentifier) === "Control") {
    document.body.classList.add("usefiles");
  }
}

function keyupHandler(evt) {
  if ((evt.key || evt.keyIdentifier) === "Control") {
    document.body.classList.remove("usefiles");
  }
}

window.app = {
  updateFrameCount: ui.updateFrameCount,
  play: animation.play,
};

listen(document, "keydown", keydownHandler);
listen(document, "keyup", keyupHandler);

// Attempt to disable default Safari iOS pinch to zoom (failed)

// listen('touchmove', function (event) {
//   if (event.scale !== 1) { event.preventDefault();  event.stopPropagation();}
//   if (event.changedTouches.length > 1){
//     event.preventDefault(); event.stopPropagation();
//   }
// }, false);

// Attempt again to disable default Safari iOS pinch to zoom and replace with our own zoom
function gestureStart(event) {}

function gestureChange(event) {
  // Disable browser zoom
  event.preventDefault();
  // need centre point between fingers to zoom from and amount to zoom
}

function gestureEnd(event) {}

listen(document.documentElement, "gesturestart", gestureStart);
listen(document.documentElement, "gesturechange", gestureChange);
listen(document.documentElement, "gestureed", gestureEnd);

// Disable default Safari iOS double-tap to zoom
var lastTouchEnd = 0;
listen(document, "touchend", function (event) {
  var now = new Date().getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
});

/* Initialize Undo UI */
const undoButtons = {
  frameUndo: $("#frameundo"),
  frameRedo: $("#frameredo"),
};

/* Show current undo options on buttons */
function updateUndo(evt) {
  ["frameUndo", "frameRedo"].forEach(key => {
    if (evt.detail[key]) {
      undoButtons[key].disabled = false;
      undoButtons[key].innerText =
        (key.endsWith("Undo") ? "Undo " : "Redo ") + evt.detail[key];
    } else {
      undoButtons[key].innerText = key.endsWith("Undo") ? "Undo" : "Redo";
      undoButtons[key].disabled = true;
    }
  });
  const frameCount = $$(".frame").length;
  if (frameCount > 1) {
    $("#framedelete").removeAttribute("disabled");
  } else {
    $("#framedelete").setAttribute("disabled", "disabled");
  }
}
listen(document, "shimmy-undo-change", updateUndo);

// Show About dialogue the first time someone visits.
if (!localStorage.hasSeenAbout) {
  localStorage.hasSeenAbout = true;
  aboutShimmyDialog.showModal();
  setTimeout(() => aboutShimmyDialog.close(), 3000);
}

// If we don't explicitly request moat integration, hide it

// Show/Hide Timeline

function toggleVisible(element) {
  element.hasAttribute("hidden")
    ? element.removeAttribute("hidden")
    : element.setAttribute("hidden", "hidden");
}

function toggleTimeline() {
  $$(".timeline > div").forEach(toggleVisible);
}

//////////////////////////////////////////////////////////
//
// keyboard shortcuts
//
//////////////////////////////////////////////////////////

var isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

function addShortcuts(shortcuts, fn, uxid, macHint, pcHint) {
  key(shortcuts, (evt, handler) => {
    fn(evt, handler);
    return false;
  });
  if (!uxid) {
    return;
  }
  let elems = $$(uxid);
  elems.forEach(
    elem => (elem.title = elem.title + " (" + (isMac ? macHint : pcHint) + ")")
  );
}

function changePenOrEraserSize(evt, handler) {
  let ui = null;
  if (currentTool === tools.pen) {
    ui = $("#pensize");
  } else if (currentTool === tools.eraser) {
    ui = $("#erasersize");
  } else {
    return;
  }
  if (handler.shortcut.endsWith("-")) {
    ui.stepDown();
  } else {
    ui.stepUp();
  }
  ui.oninput(); // this is messed up, but whatever works, if I replace how Steppers work this will have to change
  // ui.dispatchEvent(new Event('change', {bubbles: true})); // notify listeners that the value has changed
}

function render() {
  if (state.dirty) {
    state.dirty = false;
    ui.name = state.name;
    ui.tool = state.tool;
    ui.doOnionskin = state.doOnionskin;
    ui.fps = state.fps;
    ui.palette = state.palette;
    ui.color = state.color;
    ui.bgcolor = state.bgcolor;
    ui.color1 = state.color1;
    ui.color2 = state.color2;
    ui.color3 = state.color3;
    ui.color4 = state.color4;
    ui.color5 = state.color5;
    ui.color6 = state.color6;
    ui.color7 = state.color7;
    ui.color8 = state.color8;
    ui.tab_file = state.tab_file;
    ui.tab_draw = state.tab_draw;
    ui.tab_frames = state.tab_frames;
    ui.tab_animate = state.tab_animate;
  }
  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// Key shortcuts: Command: ⌘
//                Control: ⌃
//                Shift:   ⇧
//              Backspace: ⌫
//                Delete:  ⌦
//                Arrows: ← →

addShortcuts("esc", () => $("#shimmy").click(), "#shimmy", "esc", "esc");
addShortcuts("d", toggleDisplay, "", "d", "d");
// Undo/Redo
addShortcuts(
  "⌘+z, ctrl+z",
  () => undo.undo(ui.currentFrame()),
  "#frameundo",
  "⌘-z",
  "⌃-z"
);
addShortcuts(
  "shift+⌘+z, ctrl+y",
  () => undo.redo(ui.currentFrame()),
  "#frameredo",
  "⇧+⌘+z",
  "⌃+y"
);
// Files
addShortcuts("n", newAnimation, "#filenew", "n", "n");
addShortcuts("⌘+s, ctrl+s", saveAsSvg, "#filesave", "⌘+s", "⌃+s");
addShortcuts("⌘+o, ctrl+o", openSvg, "#fileopen", "⌘+o", "⌃+o");
addShortcuts("g", saveAsGif, "#filegif", "g", "g");
addShortcuts("p", saveAsSpritesheet, "#filepng", "p", "p");
// Tools
addShortcuts("shift+1", () => selectTool("pen"), "#toolpen", "⇧+1", "⇧+1");
addShortcuts(
  "shift+2",
  () => selectTool("rotate"),
  "#toolrotate",
  "⇧+2",
  "⇧+2"
);
addShortcuts("shift+3", () => selectTool("move"), "#toolmove", "⇧+3", "⇧+3");
addShortcuts(
  "shift+4",
  () => selectTool("zoomin"),
  "#toolzoomin",
  "⇧+4",
  "⇧+4"
);
addShortcuts(
  "shift+5",
  () => selectTool("zoomout"),
  "#toolzoomout",
  "⇧+5",
  "⇧+5"
);
addShortcuts(
  "shift+6",
  () => selectTool("eraser"),
  "#tooleraser",
  "⇧+6",
  "⇧+6"
);
addShortcuts(
  "shift+=, =, -",
  changePenOrEraserSize,
  "#pensize,#erasersize",
  "+/-",
  "+/-"
);
// TODO: Add zoomin in/out without switching tools
// colors
addShortcuts("1", () => $("#color1").click(), "#color1", "1", "1");
addShortcuts("2", () => $("#color2").click(), "#color2", "2", "2");
addShortcuts("3", () => $("#color3").click(), "#color3", "3", "3");
addShortcuts("4", () => $("#color4").click(), "#color4", "4", "4");
addShortcuts("5", () => $("#color5").click(), "#color5", "5", "5");
addShortcuts("6", () => $("#color6").click(), "#color6", "6", "6");
addShortcuts("7", () => $("#color7").click(), "#color7", "7", "7");
addShortcuts("8", () => $("#color8").click(), "#color8", "8", "8");
// Frames
addShortcuts("shift+n", frames.addFrame, "#framenew", "⇧+n", "⇧+n");
addShortcuts(
  "shift+backspace, shift+delete",
  frames.deleteFrame,
  "#framedelete",
  "⇧+⌫",
  "⇧+⌦"
);
addShortcuts("shift+c", frames.cloneFrame, "#framecopy", "⇧+c", "⇧+c");
addShortcuts("shift+x", frames.clearFrame, "#frameclear", "⇧+x", "⇧+x");
addShortcuts("shift+left", frames.goToFirstFrame, "#framefirst", "⇧+←", "⇧+←");
addShortcuts("left", frames.decrementFrame, "#frameprev", "←", "←");
addShortcuts("right", frames.incrementFrame, "#framenext", "→", "→");
addShortcuts(
  "shift+right",
  frames.gotoLastFrame,
  "#framelast",
  frames.gotoLastFrame,
  "⇧+→",
  "⇧+→"
);
addShortcuts("k", () => $("#doonionskin").click(), "#doonionskin", "k", "k");
// Animate
addShortcuts("r", animation.play, "animateplay", "r", "r");

// Promote number inputs to steppers
$$("input[type=number]").forEach(stepper.upgrade);

// EVENT HANDLERS

// UI Events
listen(".palettechooser", "change", ui.setPaletteHandler);
listen("#shimmy", "click", ui.toggleUI);
listen("#about", "click", ui.showAbout);
listen("#frameundo", "click", evt => undo.undo(ui.currentFrame()));
listen("#frameredo", "click", evt => undo.redo(ui.currentFrame()));
listen("#file", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#filenew", "click", newAnimation);
listen("#fileopen", "click", openSvg);
listen("#filesave", "click", saveAsSvg);
listen("#filegif", "click", saveAsGif);
listen("#filepng", "click", saveAsSpritesheet);
listen("#save-moat", "click", saveToMoat);
listen("#draw", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#toolpicker", "change", evt => selectToolHandler(evt.currentTarget));
listen(
  "#pensize",
  "change",
  evt => (currentStrokeWidth = Number(evt.currentTarget.value))
);
listen(
  "#erasersize",
  "change",
  evt => (currentEraserWidth = Number(evt.currentTarget.value))
);
listen("#pencolor, #backgroundcolor", "click", evt =>
  colorPopup(evt.currentTarget)
);
listen(".js-miniwell", "click", evt => selectColor(evt.currentTarget));
listen(".js-miniwell", "dblclick", evt => colorPopup(evt.currentTarget));
listen("#frames", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#framedelete", "click", frames.deleteFrame);
listen("#framenew", "click", frames.addFrame);
listen("#framecopy", "click", frames.cloneFrame);
listen("#frameclear", "click", frames.clearFrame);
listen("#framefirst", "click", frames.gotoFirstFrame);
listen("#frameprev", "click", frames.decrementFrame);
listen("#framenext", "click", frames.incrementFrame);
listen("#framelast", "click", frames.gotoLastFrame);
listen("#doonionskin", "change", evt => setOnionSkin(evt.currentTarget));
listen("#animate", "click", evt => ui.toggleToolbar(evt.currentTarget.id));
listen("#animateplay", "click", animation.play);
listen("#framerate", "change", evt => setFrameRate(evt.currentTarget));
listen("#timeline", "click", toggleTimeline);
listen("#shortcuts", "click", ui.showShortcuts);
// File Events
listen(window, "unload", saveLocal);
listen(window, "load", restoreLocal);
