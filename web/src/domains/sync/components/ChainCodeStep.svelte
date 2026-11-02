<script>
    import QRCode from 'qrcode';
    import Icon from '../../../shared/components/Icon.svelte';
    import { downloadTextFile } from '../../../shared/download.js';
    import { notify } from '../../ui/ui.service.svelte.js';
    import { chainCodeFileText, confirmationPositions } from '../chain-code.js';

    /**
     * Shows a new sync chain code once and makes sure it was saved: the 24 words, a QR
     * code, download and copy, then typing back a few of the words.
     */
    let { code, ondone } = $props();

    const intros = {
        created: 'Your sync chain is ready. This is its code: you need it to add another device.',
        claimed: 'Your synced playlists are now a sync chain. This is its code: you need it to add another device.',
        replaced: 'The chain has a new code. The old one no longer works, and your other devices were removed.',
    };

    const positions = $derived(confirmationPositions(3));
    let answers = $state(['', '', '']);
    let qr = $state('');

    const confirmed = $derived(positions.every((p, i) => answers[i].trim().toLowerCase() === code.words[p - 1]));

    $effect(() => {
        answers = ['', '', ''];
        QRCode.toDataURL(code.words.join(' '), { margin: 1, width: 132, errorCorrectionLevel: 'M' })
            .then((url) => (qr = url))
            .catch(() => (qr = ''));
    });

    const download = () => downloadTextFile('sync-chain-code.txt', chainCodeFileText(code.words));

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code.words.join(' '));
            notify('Copied the code. Paste it somewhere safe, like a password manager.');
        } catch {
            notify('Couldn’t copy; download the code instead', { tone: 'error' });
        }
    };
</script>

<section aria-labelledby="chain-code-title">
    <h3 id="chain-code-title" class="mb-1 font-semibold">Save your sync chain code</h3>
    <p class="text-sm text-base-content/65">{intros[code.reason] ?? intros.created}</p>
    <p class="mt-2 text-sm font-medium">
        Anyone with these words can see and change your playlists. Keep them somewhere safe and private, like a password
        manager. They won’t be shown again.
    </p>

    <ol
        class="words mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-box bg-base-200 p-3 font-mono text-sm sm:grid-cols-4"
    >
        {#each code.words as word, i (i)}
            <li><span class="text-base-content/50">{i + 1}.</span> {word}</li>
        {/each}
    </ol>

    <div class="mt-3 flex flex-wrap items-center gap-4">
        {#if qr}
            <img class="qr rounded-box bg-white p-1" src={qr} alt="The code as a QR code" width="132" height="132" />
        {/if}
        <div class="flex flex-col gap-2">
            <button class="btn btn-sm" type="button" onclick={download}>
                <Icon name="download" size={16} /> Download as .txt
            </button>
            <button class="btn btn-sm" type="button" onclick={copy}>Copy</button>
        </div>
    </div>

    <fieldset class="fieldset mt-4">
        <legend class="fieldset-legend">Check that you saved it</legend>
        <div class="flex flex-wrap gap-2">
            {#each positions as position, i (position)}
                <label class="input input-sm w-36">
                    <span class="label">Word {position}</span>
                    <input bind:value={answers[i]} autocomplete="off" autocapitalize="off" spellcheck="false" />
                </label>
            {/each}
        </div>
    </fieldset>

    <div class="mt-4 flex justify-end">
        <button class="btn btn-primary" type="button" disabled={!confirmed} onclick={() => ondone?.()}>
            I’ve saved the code
        </button>
    </div>
</section>

<style lang="scss">
    // A number and its word always stay on one line.
    .words li {
        white-space: nowrap;
    }

    .qr {
        flex: none;
    }
</style>
