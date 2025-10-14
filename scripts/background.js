'use strict';

const canvas = document.querySelector("#canvas");
let gl, program, vao;
let pMatrix;
let u_mpMatrixLoc, u_mousePositionLoc, u_timeLoc;
let mouseX = 0, mouseY = 0;
let startTime = performance.now();

const GRID_SIZE = 70;

function updatePointerPosition(x, y) {
    mouseX = x - canvas.width / 2;
    mouseY = canvas.height / 2 - y;
}

// Desktop mouse
window.addEventListener('mousemove', (e) => {
    updatePointerPosition(e.clientX, e.clientY);
});

// Mobile touch
window.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (touch) updatePointerPosition(touch.clientX, touch.clientY);
});

window.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (touch) updatePointerPosition(touch.clientX, touch.clientY);
});

window.addEventListener('resize', () => {
    resizeCanvas();
    rebuildGrid();
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    pMatrix = new Matrix3().makeOrthographic(-canvas.width / 2, canvas.width / 2, canvas.height / 2, -canvas.height / 2);
}

const vertexShaderSource = `#version 300 es

    precision highp float;

    uniform mat3 u_mpMatrix;
    uniform vec2 u_mousePosition;
    uniform float u_time;

    in vec2 a_position;

    void main() {
        float radius = 150.0;          // influence radius
        float maxDisplacement = 60.0;  // max offset distance

        vec2 toFrom = a_position - u_mousePosition;
        float dist = length(toFrom);
        vec2 dir = normalize(toFrom);

        // smooth falloff: 1 near mouse -> 0 far away
        float falloff = smoothstep(radius, 0.0, dist);

        // spring-like effect using sine and exponential decay
        float t = u_time * 5.0;
        float decay = exp(-3.0 * falloff * u_time) * sin(t) * 0.5 + 1.0;

        vec2 displaced = a_position + dir * maxDisplacement * falloff * decay;

        vec3 pos = u_mpMatrix * vec3(displaced, 1.0);
        gl_Position = vec4(pos.xy, 0.0, 1.0);
        gl_PointSize = 0.75;
    }
`;

const fragmentShaderSource = `#version 300 es

    precision highp float;

    out vec4 outColor;

    void main() {
        outColor = vec4(0.8, 0.8, 0.8, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
    }
    return program;
}

function getWebGL2Context(canvas) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported.");
    return gl;
}

function main() {
    resizeCanvas();
    gl = getWebGL2Context(canvas);

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    // Uniforms
    u_mpMatrixLoc = gl.getUniformLocation(program, "u_mpMatrix");
    u_mousePositionLoc = gl.getUniformLocation(program, "u_mousePosition");
    u_timeLoc = gl.getUniformLocation(program, "u_time");

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    vao.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vao.positionBuffer);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    rebuildGrid();
    requestAnimationFrame(updateAndRender);
}

function rebuildGrid() {
    const positions = [];

    const maxDim = Math.max(canvas.width, canvas.height);
    const step = maxDim / (GRID_SIZE - 1);

    // number of steps along each axis so spacing stays uniform
    const cols = Math.ceil(canvas.width / step);
    const rows = Math.ceil(canvas.height / step);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            positions.push(
                x * step - canvas.width / 2 + step / 2,
                y * step - canvas.height / 2 + step / 2
            );
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vao.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    vao.vertexCount = positions.length / 2;
}


function updateAndRender() {
    gl.useProgram(program);

    const time = (performance.now() - startTime) * 0.001; // seconds

    const mMatrix = new Matrix3().makeTranslation(0, 0);
    const mpMatrix = pMatrix.clone().multiplyMatrix(mMatrix);

    gl.uniformMatrix3fv(u_mpMatrixLoc, false, mpMatrix.elements);
    gl.uniform2fv(u_mousePositionLoc, [mouseX, mouseY]);
    gl.uniform1f(u_timeLoc, time);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, vao.vertexCount);

    requestAnimationFrame(updateAndRender);
}

window.onload = main;

//

class Matrix3 {

    constructor() {
        this.elements = new Float32Array(9);
        this.makeIdentity();
    }

    clone() {
        const newMatrix = new Matrix3();
        for (let i = 0; i < 9; i++) {
            newMatrix.elements[i] = this.elements[i];
        }
        return newMatrix;
    }

    copy(m) {
        for (let i = 0; i < 9; i++) {
            this.elements[i] = m.elements[i];
        }
        return this;
    }

    // Takes parameters in row-major order, but stores in column-major
    set(m11, m12, m13, m21, m22, m23, m31, m32, m33) {
        const e = this.elements;
        e[0] = m11; e[3] = m12; e[6] = m13;
        e[1] = m21; e[4] = m22; e[7] = m23;
        e[2] = m31; e[5] = m32; e[8] = m33;
        return this;
    }

    makeIdentity() {
        this.set(
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        );
        return this;
    }

    makeScale(x, y) {
        this.set(
            x, 0, 0,
            0, y, 0,
            0, 0, 1
        );
        return this;
    }

    makeRotation(degrees) {
        const radians = degrees * Math.PI / 180;
        const c = Math.cos(radians);
        const s = Math.sin(radians);
        this.set(
            c, s, 0,
            -s, c, 0,
            0, 0, 1
        );
        return this;
    }

    makeTranslation(x, y) {
        this.set(
            1, 0, x,
            0, 1, y,
            0, 0, 1
        );
        return this;
    }

    makeOrthographic(l, r, t, b) {
        this.set(
            2 / (r - l), 0, 0,
            0, 2 / (t - b), 0,
            -(r + l) / (r - l), -(t + b) / (t - b), 1
        );
        return this;
    }

    multiplyScalar(s) {
        for (let i = 0; i < 9; i++) {
            this.elements[i] *= s;
        }
        return this;
    }

    multiplyVector(v) {
        const e = this.elements;
        return new Vector3(
            e[0] * v.x + e[3] * v.y + e[6] * v.z,
            e[1] * v.x + e[4] * v.y + e[7] * v.z,
            e[2] * v.x + e[5] * v.y + e[8] * v.z,
        );
    }

    multiplyMatrix(m) {
        const a = this.elements;
        const b = m.elements;
        this.set(
            (a[0] * b[0] + a[3] * b[1] + a[6] * b[2]), (a[0] * b[3] + a[3] * b[4] + a[6] * b[5]), (a[0] * b[6] + a[3] * b[7] + a[6] * b[8]),
            (a[1] * b[0] + a[4] * b[1] + a[7] * b[2]), (a[1] * b[3] + a[4] * b[4] + a[7] * b[5]), (a[1] * b[6] + a[4] * b[7] + a[7] * b[8]),
            (a[2] * b[0] + a[5] * b[1] + a[8] * b[2]), (a[2] * b[3] + a[5] * b[4] + a[8] * b[5]), (a[2] * b[6] + a[5] * b[7] + a[8] * b[8])
        );
        return this;
    }
}