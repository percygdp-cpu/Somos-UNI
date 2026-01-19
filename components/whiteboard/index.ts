// Exportar todos los componentes de whiteboard
export { default as WhiteboardCanvas } from './WhiteboardCanvas'
export type { WhiteboardCanvasRef } from './WhiteboardCanvas'

export { default as WhiteboardToolbar } from './WhiteboardToolbar'
export { default as WhiteboardToolbarExpanded } from './WhiteboardToolbarExpanded'
export type {
    DrawingTool, Geometry2DFigure as Geometry2DFigureType, Geometry2DTool, Geometry3DTool, PenMode
} from './WhiteboardToolbarExpanded'

export { default as ToolbarSection } from './ToolbarSection'

export { default as Geometry2DLayer, createGeometry2DFigure } from './Geometry2DLayer'
export { default as Geometry3DViewer, createGeometry3DObject } from './Geometry3DViewer'
export { default as Geometry3DViewerDynamic } from './Geometry3DViewerDynamic'

export { default as FormulaEditor } from './FormulaEditor'
export { default as FormulaEditorEnhanced } from './FormulaEditorEnhanced'

export { default as OCRPanel } from './OCRPanel'
