import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import { Badge } from "@/components/ui/badge";
import { inferMediaTypeFromUrl, resolveVideoPreview } from "@/features/homework/pages/homework.utils";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

const renderVideoPlayer = ({ preview, taskTitle, taskIndex, url }) => {
  if (preview.kind === "youtube" && preview.youtubeId) {
    return (
      <LiteYouTubeEmbed
        id={preview.youtubeId}
        title={taskTitle || `Task ${taskIndex + 1} video`}
        noCookie
        adNetwork={false}
        poster="maxresdefault"
        params="cc_load_policy=0&iv_load_policy=3&modestbranding=1&rel=0"
        webp
      />
    );
  }

  if (preview.kind === "vimeo") {
    return (
      <iframe
        src={preview.src}
        title={taskTitle || `Task ${taskIndex + 1} video`}
        className="aspect-video w-full rounded-2xl"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (preview.kind === "direct") {
    return <video controls className="aspect-video w-full rounded-2xl" src={preview.src} />;
  }

  return (
    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      Resource:{" "}
      <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-slate-900 underline underline-offset-2">
        Open link
      </a>
    </p>
  );
};

export default function MediaBlock({ block, task, taskIndex = 0 }) {
  const url = String(block?.data?.url || task?.resource_url || "").trim();
  if (!url) return null;

  const mediaType =
    String(block?.data?.media_type || "").trim().toLowerCase()
    || inferMediaTypeFromUrl(url, "video")
    || "video";

  if (mediaType === "image") {
    return (
      <BlockSurfaceCard>
        <BlockHeader title="Hình ảnh tài liệu" description="Mở ảnh để xem rõ nội dung bài." />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <img
            src={url}
            alt={task?.title || `Task ${taskIndex + 1} media`}
            className="max-h-[420px] w-full rounded-xl object-contain"
          />
        </div>
      </BlockSurfaceCard>
    );
  }

  const preview = resolveVideoPreview(url || "");

  return (
    <BlockSurfaceCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BlockHeader title="Video bài học" description="Xem tài liệu trước khi làm bài." />
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
          Video
        </Badge>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-1">
        {renderVideoPlayer({ preview, taskTitle: task?.title, taskIndex, url })}
      </div>
    </BlockSurfaceCard>
  );
}
