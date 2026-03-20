"use client";

import { LaptopMinimal, Moon, Sun } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import type { ThemePreference } from "../lib/theme";
import { useTheme } from "./theme-provider";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: LaptopMinimal },
];

export function ThemeToggle() {
  const { mounted, resolvedTheme, setThemePreference, themePreference } =
    useTheme();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Appearance</p>
        <p className="text-sm text-muted-foreground">
          {mounted
            ? themePreference === "system"
              ? `Following system setting (${resolvedTheme})`
              : `Using ${resolvedTheme} theme`
            : "Loading theme preference..."}
        </p>
      </div>

      <div
        className="rounded-xl border border-border bg-muted/40 p-1"
        role="group"
        aria-label="Theme selection"
        suppressHydrationWarning
      >
        <div className="grid grid-cols-3 gap-1">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const active = mounted && themePreference === option.value;

            return (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-12 flex-col gap-1 rounded-lg px-2 text-xs font-medium",
                  active
                    ? "bg-background text-foreground shadow-sm hover:bg-background"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                )}
                aria-pressed={active}
                onClick={() => setThemePreference(option.value)}
              >
                <Icon className="size-4" strokeWidth={1.9} />
                <span>{option.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
