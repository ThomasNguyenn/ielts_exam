import { IconCloud } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveSubmissionStatusText } from "./lessonViewModel";

export default function LessonSubmissionPanel({
  hasTextInput,
  hasImageInput,
  hasAudioInput,
  draft,
  submission,
  canInteract,
  canSubmit,
  isPreviewMode,
  isDeadlinePassed,
  shouldUseDictationTranscript,
  textAnswerPlaceholder,
  textAnswerWordCount,
  uploadInputId,
  onDraftChange,
  onStartRecord,
  onStopRecord,
  onClearAudio,
  onSubmit,
}) {
  const selectedImageFiles = Array.isArray(draft?.image_files) ? draft.image_files : [];
  const selectedImageFileNames = selectedImageFiles
    .map((file) => String(file?.name || "").trim())
    .filter(Boolean);

  const handleSelectMediaFiles = (event) => {
    const nextFiles = Array.from(event?.target?.files || []);
    if (nextFiles.length === 0) return;

    const merged = [...selectedImageFiles, ...nextFiles];
    const uniqueFiles = [];
    const seen = new Set();
    merged.forEach((file) => {
      const key = [
        String(file?.name || "").trim(),
        String(file?.size || 0),
        String(file?.lastModified || 0),
        String(file?.type || "").trim(),
      ].join("|");
      if (!key || seen.has(key)) return;
      seen.add(key);
      uniqueFiles.push(file);
    });

    onDraftChange?.({ image_files: uniqueFiles });
    if (event?.target) event.target.value = "";
  };

  return (
    <div className="space-y-5">
      {hasTextInput && !shouldUseDictationTranscript ? (
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-black text-slate-900">Text Answer</CardTitle>
                <p className="text-sm text-slate-500">Write your final response before submitting.</p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                {textAnswerWordCount} words
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[180px] rounded-2xl border-slate-300 text-sm leading-7"
              value={draft.text_answer || ""}
              onChange={(event) => onDraftChange?.({ text_answer: event.target.value })}
              disabled={!canInteract}
              placeholder={textAnswerPlaceholder}
            />
          </CardContent>
        </Card>
      ) : null}

      {hasImageInput ? (
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <Input
            id={uploadInputId}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleSelectMediaFiles}
            disabled={!canInteract}
          />

          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={selectedImageFiles.length ? "default" : "outline"}
                    className="rounded-full px-3 py-1"
                  >
                    {selectedImageFiles.length ? `${selectedImageFiles.length} file đã chọn` : "Chưa chọn file"}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black">Nộp ảnh / Video bài làm</CardTitle>
              </div>

              {submission?.image_items?.length ? (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Hiện tại: {submission.image_items.length} file
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Card
              className={`rounded-2xl border-dashed shadow-none transition-colors ${
                selectedImageFiles.length ? "border-primary/40 bg-primary/[0.04]" : "bg-muted/40"
              }`}
            >
              <CardContent className="space-y-3 p-4">
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-2xl"
                  disabled={!canInteract}
                >
                  <label
                    htmlFor={canInteract ? uploadInputId : undefined}
                    className={canInteract ? "cursor-pointer" : "pointer-events-none cursor-not-allowed"}
                  >
                    <IconCloud className="mr-2 h-4 w-4" />
                    {selectedImageFiles.length ? "Thêm file" : "Upload"}
                  </label>
                </Button>
              </CardContent>
            </Card>

            {selectedImageFileNames.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">File đã chọn</p>
                <div className="flex flex-wrap gap-2">
                  {selectedImageFileNames.slice(0, 6).map((fileName, index) => (
                    <Badge
                      key={`${fileName}-${index}`}
                      variant="outline"
                      className="max-w-full truncate rounded-full px-3 py-1"
                      title={fileName}
                    >
                      {fileName}
                    </Badge>
                  ))}
                  {selectedImageFileNames.length > 6 ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      +{selectedImageFileNames.length - 6} file
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có file nào được chọn.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {hasAudioInput ? (
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-black">Audio Recording</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={draft.is_recording ? "secondary" : "default"}
                onClick={() => (draft.is_recording ? onStopRecord?.() : onStartRecord?.())}
                disabled={!canInteract || isPreviewMode}
              >
                {draft.is_recording ? "Stop recording" : "Start recording"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onClearAudio?.()}
                disabled={!canInteract || (!draft.audio_file && !draft.audio_preview_url)}
              >
                Clear
              </Button>
            </div>

            <p className="text-sm text-slate-500">
              Record directly in the browser. No audio file upload is required.
            </p>

            {draft.audio_error ? <p className="text-sm text-red-700">{draft.audio_error}</p> : null}

            {draft.audio_preview_url ? (
              <audio controls src={draft.audio_preview_url} style={{ width: "100%", marginTop: "0.4rem" }} />
            ) : submission?.audio_item?.url ? (
              <audio controls src={submission.audio_item.url} style={{ width: "100%", marginTop: "0.4rem" }} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {resolveSubmissionStatusText({ isPreviewMode, isDeadlinePassed })}
            </p>
            {submission?.status === "graded" ? (
              <Badge className="rounded-full px-3 py-1">Score: {submission?.score ?? "--"} / 10</Badge>
            ) : null}
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-2xl bg-slate-900 text-base font-black text-white hover:bg-slate-800"
            onClick={onSubmit}
            disabled={!canSubmit || draft.submitting}
          >
            {isPreviewMode ? "Preview only" : draft.submitting ? "Submitting..." : "Submit Task"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


