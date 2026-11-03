<script>
    import QRCode from 'qrcode';
    import Icon from '../../../shared/components/Icon.svelte';
    import { sync } from '../sync.service.svelte.js';
    import { countdown } from '../pairing.js';

    /**
     * Adding a device from this one with a short-lived pairing code: shows the code
     * (and its QR code), then asks to approve the device that entered it.
     */
    const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

    let now = $state(Date.now());
    let qr = $state('');

    const pairing = $derived(sync.pairing);
    const open = $derived(pairing && ['waiting', 'requested', 'approved'].includes(pairing.status));

    $effect(() => {
        if (!open) return;
        const id = setInterval(() => (now = Date.now()), 1000);
        return () => clearInterval(id);
    });

    $effect(() => {
        const code = pairing?.code;
        if (!code) {
            qr = '';
            return;
        }
        QRCode.toDataURL(code, { margin: 1, width: 132, errorCorrectionLevel: 'M' })
            .then((url) => (qr = url))
            .catch(() => (qr = ''));
    });

    // Closing the settings stops showing the code, so it can't be used unattended.
    $effect(() => () => sync.cancelPairing());
</script>

<section class="mt-4" aria-labelledby="add-device-title">
    <h3 id="add-device-title" class="mb-2 font-semibold">Add a device</h3>
    {#if sync.pairingPaused}
        <div class="alert alert-warning alert-soft items-start text-sm" role="alert">
            <Icon name="info" size={18} />
            <div>
                <p class="font-semibold">Adding devices with a pairing code is paused</p>
                <p class="mt-1">
                    Someone was refused several times while trying to join this chain, so pairing codes don’t work until
                    {timeFormat.format(new Date(sync.pairingPaused))}. If you don’t know who it was, generate a new code
                    below; you can still add a device with the chain code.
                </p>
            </div>
        </div>
    {:else if !pairing}
        <p class="mb-2 text-sm text-base-content/65">
            Show a short code here and enter it on the new device. It works once, for 10 minutes, and you approve the
            device here before it joins.
        </p>
        <button class="btn btn-sm" type="button" disabled={sync.busy} onclick={() => sync.startPairing()}>
            Show a pairing code
        </button>
    {:else if pairing.status === 'waiting'}
        <div class="flex flex-wrap items-center gap-4 rounded-box border border-base-300 p-3">
            {#if qr}
                <img
                    class="rounded-box bg-white p-1"
                    src={qr}
                    alt="The pairing code as a QR code"
                    width="132"
                    height="132"
                />
            {/if}
            <div class="min-w-0 flex-1 text-sm">
                <p class="pairing-code font-mono text-2xl font-semibold tracking-widest" aria-label="Pairing code">
                    {pairing.code}
                </p>
                <p class="mt-1 text-base-content/65">
                    On the new device, open sync settings and choose <strong>Enter a pairing code</strong>, or scan
                    this. Expires in {countdown(pairing.expiresAt, now)}.
                </p>
                <button class="btn btn-ghost btn-sm mt-2" type="button" onclick={() => sync.cancelPairing()}
                    >Cancel</button
                >
            </div>
        </div>
    {:else if pairing.status === 'requested'}
        <div class="alert alert-info alert-soft items-start text-sm" role="alertdialog" aria-labelledby="pairing-ask">
            <Icon name="info" size={18} />
            <div>
                <p id="pairing-ask" class="font-semibold">Allow {pairing.requesterName || 'this device'} to join?</p>
                <p class="mt-1">
                    It will sync every playlist in this chain. Only allow it if it’s your device and you just entered
                    the code on it. Answer within {countdown(pairing.expiresAt, now)}.
                </p>
                <div class="mt-2 flex flex-wrap gap-2">
                    <button
                        class="btn btn-primary btn-sm"
                        type="button"
                        disabled={sync.busy}
                        onclick={() => sync.approvePairing()}
                    >
                        Allow
                    </button>
                    <button class="btn btn-sm" type="button" disabled={sync.busy} onclick={() => sync.denyPairing()}>
                        Deny
                    </button>
                </div>
            </div>
        </div>
    {:else if pairing.status === 'approved'}
        <p class="flex items-center gap-2 text-sm text-base-content/65">
            <span class="loading loading-spinner loading-xs"></span>
            Allowed. Waiting for {pairing.requesterName || 'the new device'} to finish joining…
        </p>
    {:else}
        <p class="mb-2 text-sm" role="status">
            {#if pairing.status === 'joined'}
                {pairing.requesterName || 'The new device'} joined the chain.
            {:else if pairing.status === 'denied'}
                Refused. {pairing.requesterName || 'That device'} didn’t join.
            {:else}
                The pairing code expired.
            {/if}
        </p>
        <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm" type="button" disabled={sync.busy} onclick={() => sync.startPairing()}>
                Show a new pairing code
            </button>
            <button class="btn btn-ghost btn-sm" type="button" onclick={() => sync.cancelPairing()}>Done</button>
        </div>
    {/if}
</section>
