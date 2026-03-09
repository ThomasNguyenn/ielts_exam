import { IconCloud } from "@tabler/icons-react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveSubmissionStatusText } from "./lessonViewModel";

const resolveExistingItemName = (item = {}, index = 0) => {
  const storageKey = String(item?.storage_key || "").trim();
  if (storageKey) {
    const segments = storageKey.split("/").filter(Boolean);
    if (segments.length > 0) return segments[segments.length - 1];
  }
  return `uploaded-${index + 1}`;
};

const isVideoLikeItem = (item = {}) => {
  const mime = String(item?.mime || "").trim().toLowerCase();
  const url = String(item?.url || "").trim().toLowerCase();
  if (mime.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i.test(url);
};

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
  maxMediaFiles = 10,
  onDraftChange,
  onStartRecord,
  onStopRecord,
  onClearAudio,
  onSubmit,
}) {
  const existingImageItems = Array.isArray(draft?.existing_image_items) ? draft.existing_image_items : [];
  const selectedImageFiles = Array.isArray(draft?.image_files) ? draft.image_files : [];
  const safeMaxMediaFiles = Math.max(1, Number(maxMediaFiles) || 10);
  const totalMediaCount = existingImageItems.length + selectedImageFiles.length;
  const remainingSlots = Math.max(0, safeMaxMediaFiles - existingImageItems.length);
  const hasReachedLimit = totalMediaCount >= safeMaxMediaFiles;

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

    onDraftChange?.({ image_files: uniqueFiles.slice(0, remainingSlots) });
    if (event?.target) event.target.value = "";
  };

  const handleRemoveExistingItem = (targetIndex) => {
    onDraftChange?.({
      existing_image_items: existingImageItems.filter((_, index) => index !== targetIndex),
    });
  };

  const handleRemoveSelectedFile = (targetIndex) => {
    onDraftChange?.({
      image_files: selectedImageFiles.filter((_, index) => index !== targetIndex),
    });
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
            disabled={!canInteract || hasReachedLimit}
          />

          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={totalMediaCount ? "default" : "outline"}
                    className="rounded-full px-3 py-1"
                  >
                    {totalMediaCount ? `${totalMediaCount}/${safeMaxMediaFiles} file` : "Chưa chọn file"}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black">Nộp ảnh / Video bài làm</CardTitle>
              </div>

              {submission?.image_items?.length ? (
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Đã nộp: {submission.image_items.length} file
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Card
              className={`rounded-2xl border-dashed shadow-none transition-colors ${
                totalMediaCount ? "border-primary/40 bg-primary/[0.04]" : "bg-muted/40"
              }`}
            >
              <CardContent className="space-y-3 p-4">
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-2xl"
                  disabled={!canInteract || hasReachedLimit}
                >
                  <label
                    htmlFor={canInteract && !hasReachedLimit ? uploadInputId : undefined}
                    className={
                      canInteract && !hasReachedLimit
                        ? "cursor-pointer"
                        : "pointer-events-none cursor-not-allowed"
                    }
                  >
                    <IconCloud className="mr-2 h-4 w-4" />
                    {hasReachedLimit ? `Đạt giới hạn ${safeMaxMediaFiles} file` : selectedImageFiles.length ? "Thêm file" : "Upload"}
                  </label>
                </Button>
                <p className="text-xs text-slate-500">
                  Tối đa {safeMaxMediaFiles} file. Còn lại {Math.max(0, safeMaxMediaFiles - totalMediaCount)} slot.
                </p>
              </CardContent>
            </Card>

            {existingImageItems.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">File đã nộp</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {existingImageItems.map((item, index) => {
                    const itemUrl = String(item?.url || "").trim();
                    const itemName = resolveExistingItemName(item, index);
                    const isVideo = isVideoLikeItem(item);
                    return (
                      <Card key={`${String(item?.storage_key || itemUrl || "")}-${index}`} className="overflow-hidden border-slate-200">
                        <CardContent className="space-y-2 p-3">
                          {itemUrl ? (
                            isVideo ? (
                              <video controls className="h-40 w-full rounded-lg bg-slate-100 object-contain" src={itemUrl} />
                            ) : (
                              <img src={itemUrl} alt={itemName} className="h-40 w-full rounded-lg bg-slate-100 object-contain" />
                            )
                          ) : (
                            <div className="flex h-40 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
                              File không có preview
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-xs text-slate-600" title={itemName}>
                              {itemName}
                            </p>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-500 hover:text-red-600"
                              onClick={() => handleRemoveExistingItem(index)}
                              disabled={!canInteract}
                              aria-label={`Remove uploaded file ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedImageFiles.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">File mới sẽ upload khi submit</p>
                <div className="space-y-2">
                  {selectedImageFiles.map((file, index) => {
                    const fileName = String(file?.name || "").trim() || `new-file-${index + 1}`;
                    return (
                      <div key={`${fileName}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-slate-700" title={fileName}>
                          {fileName}
                        </p>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => handleRemoveSelectedFile(index)}
                          disabled={!canInteract}
                          aria-label={`Remove selected file ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {totalMediaCount === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có file nào được chọn.</p>
            ) : null}
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
