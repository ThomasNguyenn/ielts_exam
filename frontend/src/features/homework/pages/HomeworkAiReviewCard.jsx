import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomeworkAiReviewCard({
  loading,
  canSubmit,
  disabledReason,
  onGenerate,
  resultText,
  error,
  hasResult,
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle>AI Review</CardTitle>
        <CardDescription>
          Generate AI feedback from lesson prompt and student submission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onGenerate} disabled={loading || !canSubmit} className="flex-1 min-w-[180px]">
            {loading
              ? 'Generating...'
              : hasResult
                ? 'Re-generate AI Review'
                : 'Generate AI Review'}
          </Button>
          {hasResult ? (
            <Button type="button" variant="outline" onClick={onGenerate} disabled={loading || !canSubmit}>
              Refresh
            </Button>
          ) : null}
        </div>

        {!canSubmit && disabledReason ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {disabledReason}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {resultText ? (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Result</p>
            <pre className="whitespace-pre-wrap break-words text-sm text-foreground/90">{resultText}</pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
