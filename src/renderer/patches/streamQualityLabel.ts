/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { onceReady } from "@vencord/types/webpack";
import { FluxDispatcher, UserStore } from "@vencord/types/webpack/common";
import { State } from "renderer/settings";

// Discord always labels the Go Live panel with its own default quality (e.g. "1080p 30FPS"),
// so while we are streaming, show the quality picked in the screen share picker instead.
const LABEL_REGEX = /\b\d{3,4}p\s*\d{2,3}\s*FPS\b/i;

let streaming = false;
let scheduled = false;

function isOwnStream(streamKey: string) {
    return streamKey.split(":").at(-1) === UserStore.getCurrentUser().id;
}

function fixLabels() {
    scheduled = false;
    if (!streaming) return;

    const quality = State.store.screenshareQuality;
    if (!quality) return;

    const label = `${quality.resolution}p ${quality.frameRate}FPS`;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue;
        if (text && LABEL_REGEX.test(text) && !text.includes(label)) {
            node.nodeValue = text.replace(LABEL_REGEX, label);
        }
    }
}

function scheduleFix() {
    if (!streaming || scheduled) return;
    scheduled = true;
    requestAnimationFrame(fixLabels);
}

onceReady.then(() => {
    FluxDispatcher.subscribe("STREAM_CREATE", ({ streamKey }: { streamKey: string }) => {
        if (!isOwnStream(streamKey)) return;
        streaming = true;
        scheduleFix();
    });

    for (const type of ["STREAM_CLOSE", "STREAM_DELETE"]) {
        FluxDispatcher.subscribe(type, ({ streamKey }: { streamKey: string }) => {
            if (isOwnStream(streamKey)) streaming = false;
        });
    }

    new MutationObserver(scheduleFix).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
});
