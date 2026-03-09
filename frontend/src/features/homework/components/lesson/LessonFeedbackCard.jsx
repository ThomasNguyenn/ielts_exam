import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LessonFeedbackCard({ feedback }) {
  if (!String(feedback || "").trim()) return null;

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-black text-slate-900">Teacher Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-slate-700">{feedback}</p>
      </CardContent>
    </Card>
  );
}


