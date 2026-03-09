import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DictationAudioPlayer from "@/features/homework/pages/DictationAudioPlayer";
import { countWords, normalizeDictationBlockData } from "./blockUtils";
import RichTextBlock from "./RichTextBlock";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

export default function DictationBlock({
  block,
  draft,
  onChangeTextAnswer,
  onClearTextAnswer,
  disabled = false,
  showTranscriptInput = false,
  textPlaceholder = "Type what you hear...",
}) {
  const dictationData = normalizeDictationBlockData(block?.data || {});
  if (!dictationData.audio_url) return null;

  const transcript = String(draft?.text_answer || "");
  const transcriptWordCount = countWords(transcript);

  return (
    <BlockSurfaceCard className="border-sky-200 bg-gradient-to-br from-white via-sky-50/40 to-white">
      <div className="space-y-2">
        <BlockHeader
          title="Nghe và chép chính tả"
          description="Nghe audio rồi chép lại chính xác nội dung bạn nghe được."
        />
        {dictationData.prompt
          ? <RichTextBlock value={dictationData.prompt} className="text-sm leading-7 text-slate-700" />
          : (
            <p className="text-sm text-slate-600">
              Play the audio, then write down as much of the passage as you can remember.
            </p>
          )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3">
        <DictationAudioPlayer
          src={dictationData.audio_url}
          title={dictationData.prompt || "Dictation Audio"}
          className="max-w-full"
        />
      </div>

      {showTranscriptInput ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Bản chép của bạn</p>
              <p className="text-xs text-slate-500">Nội dung này dùng chung flow nộp text answer hiện tại.</p>
            </div>
            <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {transcriptWordCount} từ
            </p>
          </div>

          <Textarea
            className="min-h-[180px] rounded-2xl border-slate-300 text-sm leading-7"
            value={transcript}
            onChange={(event) => onChangeTextAnswer?.(event.target.value)}
            disabled={disabled}
            placeholder={textPlaceholder}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Dùng controls trên player để tua lại nếu cần nghe kỹ hơn.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onClearTextAnswer?.()}
              disabled={disabled || !transcript}
            >
              Clear transcript
            </Button>
          </div>
        </div>
      ) : null}
    </BlockSurfaceCard>
  );
}
