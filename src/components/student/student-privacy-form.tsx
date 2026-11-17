"use client";
import * as React from "react";
import { toast } from "sonner";
import { OptionCard } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { updateStudentPrefsAction } from "@/app/(app)/settings/actions";

type Scope = "all" | "my_school";

export function StudentPrivacyForm({ initial, schoolName }: { initial: { visible: boolean; campusScope: Scope }; schoolName: string | null }) {
  const [visible, setVisible] = React.useState(initial.visible);
  const [scope, setScope] = React.useState<Scope>(initial.campusScope);

  async function save(patch: { visible?: boolean; campusScope?: Scope }, undo: () => void) {
    const res = await updateStudentPrefsAction(patch);
    if (!res.ok) {
      undo();
      toast.error(res.error);
    } else toast.success("Saved.");
  }

  return (
    <div className="space-y-5">
      <label className="flex items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Show my profile to verified students</span>
          <span className="mt-0.5 block text-[13px] text-muted">When off, nobody can find you in Discover, matches or events.</span>
        </span>
        <Switch
          checked={visible}
          onCheckedChange={(v) => {
            setVisible(v);
            void save({ visible: v }, () => setVisible(!v));
          }}
          aria-label="Show my profile to verified students"
        />
      </label>
      <div className="grid gap-2.5" role="radiogroup" aria-label="Which campuses">
        {(["my_school", "all"] as const).map((v) => (
          <OptionCard
            key={v}
            selected={scope === v}
            title={v === "my_school" ? `${schoolName ?? "My school"} only` : "Open to other campuses"}
            description={
              v === "my_school"
                ? "You only see, and are only seen by, students at your school."
                : "Meet student founders at every school on FoundMate."
            }
            onSelect={() => {
              const prev = scope;
              setScope(v);
              void save({ campusScope: v }, () => setScope(prev));
            }}
          />
        ))}
      </div>
    </div>
  );
}
