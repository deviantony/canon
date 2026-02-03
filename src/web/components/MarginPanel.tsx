import { useMemo } from 'react'
import { useAnnotations } from '../context/AnnotationContext'
import { useLayout } from '../context/LayoutContext'
import AnnotationCard, { NewAnnotationCard } from './AnnotationCard'

interface MarginPanelProps {
  filePath: string
  onLineClick: (line: number) => void
  lineHeight?: number
}

// CodeMirror line height: 13px font * 1.7 line-height
const DEFAULT_LINE_HEIGHT = 22.1
// Padding at top of code content area
const CODE_CONTENT_PADDING = 12

export default function MarginPanel({
  filePath,
  onLineClick,
  lineHeight = DEFAULT_LINE_HEIGHT,
}: MarginPanelProps) {
  const { getSortedAnnotationsForFile, addAnnotation, updateAnnotation, removeAnnotation } = useAnnotations()
  const { selectedLines, setSelectedLines, highlightedAnnotationId, editorScrollTop } = useLayout()

  // Get line-based annotations only (file-level shown in footer)
  const lineAnnotations = getSortedAnnotationsForFile(filePath).filter(a => a.lineStart !== 0)

  // Calculate the Y position for a given line number
  const getPositionForLine = (line: number): number => {
    return (line - 1) * lineHeight - editorScrollTop + CODE_CONTENT_PADDING
  }

  function handleSaveNew(comment: string) {
    if (selectedLines) {
      const lineEnd = selectedLines.end !== selectedLines.start ? selectedLines.end : undefined
      addAnnotation(filePath, selectedLines.start, comment, lineEnd)
      setSelectedLines(null)
    }
  }

  function handleCancelNew() {
    setSelectedLines(null)
  }


  // Calculate positions for line-based annotations
  const annotationPositions = useMemo(() => {
    return lineAnnotations.map((annotation) => ({
      annotation,
      y: getPositionForLine(annotation.lineStart),
    }))
  }, [lineAnnotations, editorScrollTop, lineHeight])

  // Position for new annotation if selected
  const newAnnotationY = selectedLines ? getPositionForLine(selectedLines.start) : null

  return (
    <div className="margin-panel">
      <div className="margin-panel-content">
        <div className="margin-annotations-container">
          {annotationPositions.map(({ annotation, y }) => (
            <div
              key={annotation.id}
              className="line-annotation"
              style={{
                position: 'absolute',
                top: y,
                left: 0,
                right: 0,
              }}
            >
              <AnnotationCard
                annotation={annotation}
                onUpdate={(comment) => updateAnnotation(annotation.id, comment)}
                onDelete={() => removeAnnotation(annotation.id)}
                onLineClick={onLineClick}
              />
            </div>
          ))}

          {selectedLines && newAnnotationY !== null && (
            <NewAnnotationCard
              key="new"
              lineStart={selectedLines.start}
              lineEnd={selectedLines.end}
              onSave={handleSaveNew}
              onCancel={handleCancelNew}
              style={{
                position: 'absolute',
                top: newAnnotationY,
                left: 0,
                right: 0,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
