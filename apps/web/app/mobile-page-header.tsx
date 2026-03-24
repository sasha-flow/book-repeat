"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { getMobilePageHeaderLayout } from "../lib/mobile-page-header";

export function MobilePageHeader({
  title,
  leading,
  trailing,
}: {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const layout = getMobilePageHeaderLayout();

  return (
    <div
      className="relative border-b border-border bg-background"
      style={{
        height: layout.headerHeight,
        borderBottomWidth: layout.borderBottomWidth,
        borderBottomColor: "var(--border)",
      }}
    >
      <div
        className="absolute"
        style={{
          left: layout.actionInsetX,
          top: layout.actionInsetTop,
          width: layout.actionSize,
          height: layout.actionSize,
        }}
      >
        {leading}
      </div>

      <div
        className="absolute flex items-center justify-center px-2"
        style={{
          left: layout.titleInsetX,
          right: layout.titleInsetX,
          top: layout.titleInsetTop,
          height: layout.titleHeight,
        }}
      >
        <h1 className="line-clamp-1 text-center text-[20px] font-medium leading-[30px] text-foreground">
          {title}
        </h1>
      </div>

      <div
        className="absolute flex items-center justify-end"
        style={{
          right: layout.actionInsetX,
          top: layout.actionInsetTop,
          width: layout.actionSize,
          minHeight: layout.actionSize,
        }}
      >
        {trailing}
      </div>
    </div>
  );
}

export function MobilePageHeaderButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const layout = getMobilePageHeaderLayout();

  return (
    <button
      type="button"
      className={`flex items-center justify-center rounded-[10px] text-foreground transition-colors hover:bg-accent ${className ?? ""}`.trim()}
      style={{
        width: layout.actionSize,
        height: layout.actionSize,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
