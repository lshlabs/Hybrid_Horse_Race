import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

const WEBGL_CONTEXT_IDS = ['webgl', 'webgl2', 'experimental-webgl'] as const

function create2DContextMock() {
  return {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    setTransform: () => {},
    resetTransform: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  }
}

function createWebGlContextMock() {
  return {
    getExtension: () => null,
    getParameter: () => null,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    useProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
  }
}

vi.mock('phaser', () => {
  class MockScene {
    constructor() {}
  }

  class MockGame {
    scene = {
      getScene: () => null,
    }
    canvas = null

    constructor() {}
    destroy() {}
  }

  return {
    __esModule: true,
    default: {
      Scene: MockScene,
      Game: MockGame,
      CANVAS: 'CANVAS',
      Scale: {
        NONE: 'NONE',
      },
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
          DESTROY: 'destroy',
        },
      },
      BlendModes: {
        ADD: 'ADD',
      },
    },
  }
})

// Phaser가 jsdom 환경에서도 초기화되도록 최소 Canvas API를 폴리필한다.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: (contextId: string) => {
    if (contextId === '2d') {
      return create2DContextMock()
    }

    if (WEBGL_CONTEXT_IDS.includes(contextId as (typeof WEBGL_CONTEXT_IDS)[number])) {
      return createWebGlContextMock()
    }

    return null
  },
})

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  configurable: true,
  value: () => 'data:image/png;base64,',
})
