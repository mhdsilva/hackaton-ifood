"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PartyRetrospectiveSummary } from "@sidequest/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { canShareRetrospectiveImage, createRetrospectiveShareImage, downloadRetrospectiveImage } from "@/lib/retrospective-share-image";

export function RetrospectiveShareDialog({ summary }: { summary: PartyRetrospectiveSummary }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="party" className="w-full">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></svg>
          Compartilhar esse momento
        </Button>
      </DialogTrigger>
      <DialogContent><ShareImagePreview summary={summary} /></DialogContent>
    </Dialog>
  );
}

function ShareImagePreview({ summary }: { summary: PartyRetrospectiveSummary }) {
  // O card representa os dados no instante em que a prévia foi aberta.
  const [shareSummary] = useState(summary);
  const [asset, setAsset] = useState<{ file: File; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const supportsSharing = asset ? canShareRetrospectiveImage(asset.file) : false;

  useEffect(() => {
    let alive = true;
    let url: string | undefined;
    createRetrospectiveShareImage(shareSummary).then((file) => {
      if (!alive) return;
      url = URL.createObjectURL(file);
      setAsset({ file, url });
    }).catch(() => {
      if (alive) setFailed(true);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [shareSummary, attempt]);

  function saveImage() {
    if (!asset) return;
    downloadRetrospectiveImage(asset.url, asset.file.name);
    setFeedback("Download da imagem iniciado.");
  }

  async function shareImage() {
    if (!asset || sharing) return;
    if (!supportsSharing) { saveImage(); return; }
    setSharing(true);
    setFeedback(null);
    try {
      // Arquivo pronto: share() é chamado no clique, preservando a ativação do usuário.
      await navigator.share({ files: [asset.file] });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setFeedback("Não foi possível abrir o compartilhamento. Você pode salvar a imagem abaixo.");
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <div className="space-y-1 pr-7">
        <DialogTitle className="font-preparation text-[28px] leading-tight font-bold">Esse momento merece ir além.</DialogTitle>
        <DialogDescription className="text-xs leading-5 text-order-detail">Uma imagem da Party para levar pro WhatsApp, status ou onde vocês quiserem.</DialogDescription>
      </div>
      <div className="flex min-h-[180px] items-center justify-center rounded-xl bg-secondary/40 p-2">
        {asset ? <Image src={asset.url} alt="Imagem da retrospectiva da Party, pronta para compartilhar" width={1080} height={1920} unoptimized className="mx-auto h-auto max-h-[46dvh] w-auto max-w-full rounded-lg" /> : failed ? <div role="alert" className="space-y-3 p-3 text-center">
          <p className="text-sm text-order-detail">Não foi possível montar a imagem.</p>
          <Button variant="outline" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Tentar novamente</Button>
        </div> : <p role="status" className="motion-safe:animate-pulse text-sm text-muted-foreground">Montando sua imagem...</p>}
      </div>
      <div className="space-y-2">
        <Button size="party" className="w-full" disabled={!asset || sharing} aria-busy={sharing} onClick={shareImage}>{sharing ? "Abrindo compartilhamento..." : supportsSharing ? "Compartilhar imagem" : "Baixar imagem"}</Button>
        {supportsSharing && <Button variant="outline" className="w-full" disabled={sharing} onClick={saveImage}>Salvar imagem no dispositivo</Button>}
        <p className="text-center text-[11px] leading-4 text-muted-foreground">{supportsSharing ? "Escolha entre os apps disponíveis no seu aparelho." : "Depois de baixar, envie no WhatsApp ou publique no status."}</p>
        {feedback && <p role="status" className="text-center text-xs leading-5 text-order-detail">{feedback}</p>}
      </div>
    </>
  );
}
