export const editor = {
  create: () => ({
    dispose: () => {},
    getValue: () => '',
    setValue: () => {},
    onDidChangeModelContent: () => ({ dispose: () => {} }),
    onDidChangeCursorPosition: () => ({ dispose: () => {} }),
    onDidChangeCursorSelection: () => ({ dispose: () => {} }),
    onMouseDown: () => ({ dispose: () => {} }),
    layout: () => {},
    focus: () => {},
    getModel: () => ({
      getValue: () => '',
      getLineContent: () => '',
      getPositionAt: () => ({ lineNumber: 1, column: 1 }),
      findMatches: () => [],
      getValueInRange: () => ''
    }),
    updateOptions: () => {},
    deltaDecorations: () => [],
    revealPositionInCenterIfOutsideViewport: () => {},
    revealLineInCenterIfOutsideViewport: () => {},
    setSelection: () => {},
    getPosition: () => ({ lineNumber: 1, column: 1 }),
    getSelection: () => {},
    executeEdits: () => {},
    trigger: () => {}
  }),
  setModelLanguage: () => {}
}

export class Range {
  constructor() {}
}

export class Selection {
  constructor() {}
}

export default {
  editor,
  Range,
  Selection
}
