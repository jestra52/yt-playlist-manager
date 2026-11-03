<script>
    import { scanCode } from '../qr-scan.js';

    /**
     * The camera, looking for a chain code's or a pairing code's QR code. Calls
     * `onscan` with what it found (see readScannedCode), or `oncancel`.
     */
    let { onscan, oncancel } = $props();

    let video = $state();
    let problem = $state('');

    $effect(() => {
        if (!video) return;
        const ctrl = new AbortController();
        problem = '';
        scanCode(video, { signal: ctrl.signal })
            .then((code) => code && onscan(code))
            .catch((err) => (problem = err.message));
        return () => ctrl.abort();
    });
</script>

<div class="scanner rounded-box border border-base-300 p-2">
    {#if problem}
        <p class="p-2 text-sm text-error" role="alert">{problem}</p>
    {:else}
        <video bind:this={video} class="w-full rounded-box bg-black" muted playsinline aria-label="Camera"></video>
        <p class="mt-2 text-center text-sm text-base-content/65">
            Point the camera at the QR code shown on your other device.
        </p>
    {/if}
    <div class="mt-2 flex justify-end">
        <button class="btn btn-ghost btn-sm" type="button" onclick={oncancel}>Close camera</button>
    </div>
</div>

<style>
    .scanner video {
        aspect-ratio: 1;
        object-fit: cover;
        max-height: 18rem;
    }
</style>
