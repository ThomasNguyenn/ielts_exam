import { useMemo, useState } from "react";
import { Palette, Settings2, SunMedium, Type } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TEXT_SIZE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "large", label: "Large" },
  { value: "extra-large", label: "Extra Large" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Black on White" },
  { value: "dark", label: "White on Black" },
  { value: "yellow", label: "Yellow on Black" },
];

const clampBrightness = (value) => {
  const next = Number.parseInt(value, 10);
  if (Number.isNaN(next)) return 100;
  return Math.min(150, Math.max(50, next));
};

export default function IELTSSettings({
  brightness,
  setBrightness,
  textSize,
  setTextSize,
  theme,
  setTheme,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const brightnessValue = useMemo(
    () => clampBrightness(brightness),
    [brightness],
  );

  const activeThemeLabel = useMemo(() => {
    const matched = THEME_OPTIONS.find((option) => option.value === theme);
    return matched?.label || "Custom";
  }, [theme]);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="right">
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2"
        >
          <Settings2 size={15} />
          Settings
        </Button>
      </DrawerTrigger>

      <DrawerContent className="flex h-full flex-col p-0 sm:max-w-sm" aria-describedby="exam-settings-description">
        <DrawerHeader className="border-b px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-base">Exam Settings</DrawerTitle>
            <Badge variant="outline" className="rounded-full text-[11px]">
              {activeThemeLabel}
            </Badge>
          </div>
          <DrawerDescription id="exam-settings-description" className="text-xs">
            Adjust display and reading comfort in real time.
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  <SunMedium size={14} />
                  Brightness
                </p>
                <Badge variant="secondary" className="text-[11px]">
                  {brightnessValue}%
                </Badge>
              </div>
              <input
                id="exam-brightness"
                type="range"
                min={50}
                max={150}
                step={5}
                value={brightnessValue}
                onChange={(event) => setBrightness(clampBrightness(event.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>50%</span>
                <span>150%</span>
              </div>
            </section>

            <section className="space-y-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Type size={14} />
                Text Size
              </p>
              <div className="grid gap-2">
                {TEXT_SIZE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={textSize === option.value ? "default" : "outline"}
                    className={cn("justify-start")}
                    onClick={() => setTextSize(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Palette size={14} />
                Theme
              </p>
              <div className="grid gap-2">
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={theme === option.value ? "default" : "outline"}
                    className={cn("justify-start")}
                    onClick={() => setTheme(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t p-4">
          <DrawerClose asChild>
            <Button type="button" variant="outline" className="w-full">
              Đóng
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
