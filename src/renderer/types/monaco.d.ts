declare module 'monaco-editor' {
  const monaco: {
    editor: unknown
    languages: unknown
    Uri: unknown
    [key: string]: unknown
  }
  export = monaco
}

declare module 'monaco-editor/esm/vs/editor/editor.api' {
  import type monaco from 'monaco-editor'
  export = monaco
}

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const workerFactory: { new (): Worker }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const workerFactory: { new (): Worker }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const workerFactory: { new (): Worker }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const workerFactory: { new (): Worker }
  export default workerFactory
}

declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const workerFactory: { new (): Worker }
  export default workerFactory
}

declare module '*.css' {
  const classes: Record<string, string>
  export default classes
}
