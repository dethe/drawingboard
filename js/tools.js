/* global dom file undo
   ZOOMIN ZOOMOUT degrees WIDTH HEIGHT
   currentFrame currentColor currentStrokeWidth currentMatrix currentEraserWidth */

const ZOOMIN = 1.2;
const ZOOMOUT = 1 / ZOOMIN;


class Pen {
  constructor() {
    this.name = "pen";
    this.drawing = false;
    this.currentPath = null;
    this.prevPoint = null;
  }

  select() {
    document.querySelector("svg").style.cursor =
      "url(img/pen.svg) 1 31, auto";
  }

  startPath(x, y) {
    // TODO: Change cursor to reflect current color and currentStrokeWidth
    let path = dom.svg("path", {
      d: `M${x},${y}`,
      stroke: currentColor,
      "stroke-width": currentStrokeWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      fill: "none"
    });
    this.currentPath = currentFrame().appendChild(path);
    // console.log('currentPath: %o', this.currentPath);
    file.onChange();
  }

  appendToPath(x, y) {
    this.currentPath.setAttribute(
      "d",
      this.currentPath.getAttribute("d") + ` L${x},${y}`
    );
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.firstPoint = { x, y };
    this.prevPoint = { x, y };
    this.startPath(x, y);
    this.drawing = true;
  }

  move(evt) {
    if (!this.drawing) return;
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    if (collideCircle({ x, y }, 1, this.prevPoint, 1)) {
      // too close to previous point to both drawing
      return;
    }
    this.prevPoint = { x, y };
    if (inBounds(wx, wy)) {
      this.appendToPath(x, y);
    }
  }

  stop(evt) {
    if (!this.drawing) return;
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let path = this.currentPath;
    let parent = currentFrame();
    if (this.currentPath) {
      if (inBounds(wx, wy) && this.sx === x && this.sy === y) {
        this.appendToPath(x, y);
      }
      //dom.simplifyPath(currentPath);
      this.currentPath = null;
    }
    this.drawing = false;
    currentMatrix = null;
    undo.pushUndo(
      "Draw",
      currentFrame(),
      () => path.remove(),
      () => parent.appendChild(path)
    );
  }

  cancel() {
    this.currentPath.remove();
    this.currentPath = null;
    currentMatrix = null;
  }
}

class Move {
  constructor() {
    this.name = "move";
    this.dragging = false;
    this.px = 0;
    this.py = 0;
  }

  select() {
    document.querySelector("svg").style.cursor =
      "url(img/arrows.svg) 16 16, auto";
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.px = x;
    this.py = y;
    this.dragging = true;
    this.origTransform = currentFrame().getAttribute("transform") || "";
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let dx = x - this.px;
    let dy = y - this.py;
    currentFrame().setAttribute(
      "transform",
      `${this.origTransform} translate(${dx} ${dy})`
    );
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    this.px = 9;
    this.py = 0;
    this.dragging = false;
    let oldTransform = this.origTransform;
    this.origTransform = "";
    currentMatrix = null;
    let curr = currentFrame();
    let newTransform = curr.getAttribute("transform");
    undo.pushUndo(
      "Move",
      curr,
      () => curr.setAttribute("transform", oldTransform),
      () => curr.setAttribute("transform", newTransform)
    );
  }

  cancel() {
    currentFrame().setAttribute("transform", this.origTransform);
    this.dragging = false;
    this.origTransform = false;
    currentMatrix = null;
  }
}

function dist(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}

class Rotate {
  constructor() {
    this.name = "rotate";
    this.dragging = false;
    this.px = 0;
    this.py = 0;
    this.originalAngle = null;
  }

  select() {
    document.querySelector("svg").style.cursor =
      "url(img/sync-alt.svg) 16 16, auto";
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    this.px = x;
    this.py = y;
    this.dragging = true;
    this.origTransform = currentFrame().getAttribute("transform") || "";
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let px = this.px;
    let py = this.py;
    let dx = x - px;
    let dy = y - py;
    if (dist(dx, dy) < 20) {
      return;
    } // don't pick starting angle until we've moved a little from the starting point
    if (this.originalAngle !== null) {
      let transform = this.origTransform;
      let angle = degrees(Math.atan2(dy, dx)) - this.originalAngle;
      currentFrame().setAttribute(
        "transform",
        `${transform} rotate(${angle} ${px} ${py})`
      );
    } else {
      this.originalAngle = degrees(Math.atan2(dy, dx));
    }
  }

  stop(evt) {
    if (!this.dragging) {
      return;
    }
    this.px = 9;
    this.py = 0;
    this.dragging = false;
    let oldTransform = this.origTransform;
    this.origTransform = "";
    this.originalAngle = null;
    currentMatrix = null;
    let curr = currentFrame();
    let newTransform = curr.getAttribute("transform");
    undo.pushUndo(
      "Rotate",
      curr,
      () => curr.setAttribute("transform", oldTransform),
      () => curr.setAttribute("transform", newTransform)
    );
  }

  cancel(evt) {
    currentFrame().setAttribute("transform", this.origTransform);
    this.dragging = false;
    this.origTransform = false;
    currentMatrix = null;
  }
}

class ZoomIn {
  constructor() {
    this.name = "zoomin";
  }

  select() {
    document.querySelector("svg").style.cursor =
      "url(img/expand-arrows-alt.svg) 16 16,auto";
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let curr = currentFrame();
    let oldTransform = curr.getAttribute("transform") || "";
    let newTransform = `${oldTransform} translate(${x} ${y}) scale(${ZOOMIN}) translate(-${x}, -${y})`;
    currentFrame().setAttribute("transform", newTransform);
    currentMatrix = null;
    undo.pushUndo(
      "Zoom In",
      curr,
      () => curr.setAttribute("transform", oldTransform),
      () => curr.setAttribute("transform", newTransform)
    );
  }

  move(evt) {
    // do nothing
  }

  stop(evt) {
    // do nothing
  }

  cancel(evt) {
    // do nothing
  }
}

class ZoomOut {
  constructor() {
    this.name = "zoomout";
  }

  select() {
    document.querySelector("svg").style.cursor =
      "url(img/compress-arrows-alt.svg) 16 16, auto";
  }

  start(evt) {
    saveMatrix();
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    let curr = currentFrame();
    let oldTransform = curr.getAttribute("transform") || "";
    let newTransform = `${oldTransform} translate(${x} ${y}) scale(${ZOOMOUT}) translate(-${x}, -${y})`;
    currentFrame().setAttribute("transform", newTransform);
    currentMatrix = null;
    undo.pushUndo(
      "Zoom Out",
      curr,
      () => curr.setAttribute("transform", oldTransform),
      () => curr.setAttribute("transform", newTransform)
    );
  }

  move(evt) {
    // do nothing
  }

  stop(evt) {
    // do nothing
  }

  cancel(evt) {
    // do nothing
  }
}

class Eraser {
  constructor() {
    this.name = "eraser";
  }

  select() {
    document.querySelector("svg").style.cursor =
      "url(img/eraser.svg) 16 28, auto";
  }

  start(evt) {
    saveMatrix();
    this.before = currentFrame().innerHTML;
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      console.error("Houston, we have a problem");
      return;
    }
    this.prevPoint = { x, y };
    this.dragging = true;
    if (inBounds(wx, wy)) {
      erasePaths({ x, y });
    }
  }

  move(evt) {
    if (!this.dragging) {
      return;
    }
    let { x, y, wx, wy, err } = getXY(evt);
    if (err) {
      return;
    }
    if (collideCircle({ x, y }, 1, this.prevPoint, 1)) {
      // too close to previous point to bother erasing
      return;
    }
    this.prevPoint = { x, y };
    if (inBounds(wx, wy)) {
      erasePaths({ x, y });
    }
  }

  stop(evt) {
    if (!this.dragging){
      return;
    }
    this.dragging = false;
    this.prevPoint = null;
    let before = this.before;
    let curr = currentFrame();
    let after = curr.innerHTML;
    undo.pushUndo(
      "Erase",
      curr,
      () => (curr.innerHTML = before),
      () => (curr.innerHTML = after)
    );
    this.before = null;
  }

  cancel() {
    this.dragging = false;
    this.prevPoint = null;
  }
}

// UTILITIES

function pointFromText(t) {
  // expects t to be in the form of M124,345 or L23,345, i.e. an absolute move or lineTo followed by x,y coordinates
  let cmd = t[0];
  let [x, y] = t
    .slice(1)
    .split(",")
    .map(Number);
  return { cmd, x, y };
}

function pointsFromPath(path) {
  return path
    .getAttribute("d")
    .replace(/, /g, ',')
    .split(/[ ]+/)
    .map(pointFromText);
}

function pointsToPath(points) {
  if (!points.length) {
    return null;
  }
  return points.map(pt => `${pt.cmd}${pt.x},${pt.y}`).join(" ");
}

// Because points are actually circles (due to penWidth / eraserWidth) this is a basic circl collision algorithm
function collideCircle(p1, r1, p2, r2) {
  // if (r1 > 1) {
  //   console.log(
  //     `collideCircle({x:${p1.x},y:${p1.y}}, ${r1}, {x:${p2.x},y:${p2.y}}, ${r2})`
  //   );
  // }
  return (
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) < Math.pow(r1 + r2, 2)
  );
}

function collideBox(r1, r2) {
  if (r1.x + r1.width < r2.x) {
    return false;
  }
  if (r1.y + r1.height < r2.y) {
    return false;
  }
  if (r1.x > r2.x + r2.width) {
    return false;
  }
  if (r1.y > r2.y + r2.height) {
    return false;
  }
  return true;
}

function inBounds(x, y) {
  return !(x < 0 || x > WIDTH || y < 0 || y > HEIGHT);
}

function saveMatrix() {
  let matrix = currentFrame().getCTM();
  if (matrix instanceof SVGMatrix) {
    matrix = new DOMMatrix([
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f
    ]);
  }
  currentMatrix = matrix.inverse();
}

function getXY(evt) {
  if (evt.button) {
    // left button is 0, for touch events button will be undefined
    return { x: 0, y: 0, err: true };
  }
  if (evt.touches && evt.touches.length > 1) {
    // don't interfere with multi-touch
    return { x: 0, y: 0, err: true };
  }
  if (evt.cancelable) {
    evt.preventDefault();
  }

  const rect = this.canvas.getBoundingClientRect();
  const position = (evt.changedTouches && evt.changedTouches[0]) || evt;
  let x = position.offsetX;
  let y = position.offsetY;

  if (typeof x === "undefined") {
    x = position.clientX - rect.left;
  }
  if (typeof y === "undefined") {
    y = position.clientY - rect.top;
  }
  // if the frame has been translated, rotated, or scaled, we need to map the point to the current matrix
  let { x: tx, y: ty } = transformPoint(x, y);
  return { x: tx, y: ty, wx: x, wy: y, err: false };
}

function transformPoint(x, y) {
  let frame = currentFrame();
  if (frame.transform.baseVal.length === 0) {
    return { x, y };
  }
  return currentMatrix.transformPoint(new DOMPoint(x, y));
}

function drawBoundingBox(bbox, color) {
  let r = dom.svg("rect", {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    fill: "none",
    stroke: color || "#00F"
  });
  currentFrame().appendChild(r);
}

function erasePaths(point) {
  // currentFrame()
  //   .querySelectorAll("rect")
  //   .forEach(r => r.remove());
  let candidatePaths = Array.from(currentFrame().querySelectorAll("path"));
  // console.log(`${candidatePaths.length} candidate paths`);
  // candidatePaths.forEach(path => drawBoundingBox(path.getBBox({stroke: true})));
  let paths = collidePaths(point, candidatePaths);
  // console.log(`${paths.length} matching paths`);
  // paths.forEach(path => drawBoundingBox(path.getBBox({stroke: true})));
  paths.forEach(path => erasePath(point, path));
}

function erasePath(pt1, path) {
  let r1 = currentEraserWidth;
  let r2 = Number(path.getAttribute("stroke-width"));
  let deletions = false;
  // instead of filtering, make two passes:
  // First pass, delete any points which collide and make the point which follows (if any) a Move cmd
  let points = pointsFromPath(path);
  for (let i = points.length - 1; i > -1; i--) {
    let pt2 = points[i];
    if (collideCircle(pt1, r1, pt2, r2)) {
      deletions = true;
      points.splice(i, 1); // remove the current element
      if (points[i]) {
        points[i].cmd = "M"; // change the following element to be a move, if it exists
      }
    }
  }
  if (!deletions) {
    return; // Nothing changed, we're done here
  }
  // Second pass, delete any move commands that precede other move commands
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    if (p.cmd === "M") {
      if (!points[i + 1] || points[i + 1].cmd === "M") {
        points.splice[(i, 1)]; // Don't need two moves in a row, or a trailing move
      }
    }
  }
  // Finally, if there is only a single move and no other points, delete the whole path
  if (!points.length) {
    path.remove();
  } else {
    path.setAttribute("d", pointsToPath(points));
  }
}

function collidePaths(point, paths) {
  // quck check to try to eliminate paths that don't intersect
  let d = currentEraserWidth / 2;
  let eraserBox = {
    x: point.x - d,
    y: point.y - d,
    width: currentEraserWidth,
    height: currentEraserWidth
  };
  // drawBoundingBox(eraserBox, '#F00');
  return paths.filter(path =>
    collideBox(eraserBox, path.getBBox({ stroke: true }))
  );
}
