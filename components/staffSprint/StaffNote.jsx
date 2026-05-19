"use client";

import { useEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Formatter, Voice } from "vexflow";

export default function StaffNote({ note }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !note) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const width = 260;
    const height = 160;
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const stave = new Stave(10, 20, width - 20);
    stave.addClef(note.clef);
    stave.setContext(context).draw();

    const staveNote = new StaveNote({
      clef: note.clef,
      keys: note.keys,
      duration: "w"
    });

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.addTickables([staveNote]);
    new Formatter().joinVoices([voice]).format([voice], width - 80);
    voice.draw(context, stave);
  }, [note]);

  return <div ref={containerRef} className="staff-sprint-note" aria-label="staff note" />;
}
