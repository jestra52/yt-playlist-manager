<script>
    import QRCode from 'qrcode';
    import Icon from '../../../shared/components/Icon.svelte';
    import { downloadTextFile } from '../../../shared/download.js';
    import { notify } from '../../ui/ui.service.svelte.js';
    import { chainCodeFileText, confirmationPositions } from '../chain-code.js';

    /**
     * Shows new codes once and makes sure they were saved: the chain code's 24 words with
     * a QR code, and the recovery codes, with download, copy and print; then typing back
     * a few of the words (or, for recovery codes alone, saying they were saved).
     */
    let { code, ondone } = $props();

    const intros = {
        created: 'Your sync chain is ready. This is its code: you need it to add another device.',
        claimed: 'Your synced playlists are now a sync chain. This is its code: you need it to add another device.',
        replaced:
            'The chain has a new code and new recovery codes. The old ones no longer work, and your other devices were removed.',
        recovered:
            'You’re back in your sync chain, with your playlists. It has a new code and new recovery codes: the old ones no longer work, and every other device was removed.',
        'recovery-codes': 'These are your new recovery codes. The old ones no longer work.',
    };

    const words = $derived(code.words ?? []);
    const recoveryCodes = $derived(code.recoveryCodes ?? []);
    const positions = $derived(words.length ? confirmationPositions(3) : []);
    let answers = $state(['', '', '']);
    let codesSaved = $state(false);
    let qr = $state('');

    const confirmed = $derived(
        words.length ? positions.every((p, i) => answers[i].trim().toLowerCase() === words[p - 1]) : codesSaved,
    );

    $effect(() => {
        answers = ['', '', ''];
        codesSaved = false;
        if (!code.words?.length) {
            qr = '';
            return;
        }
        QRCode.toDataURL(code.words.join(' '), { margin: 1, width: 132, errorCorrectionLevel: 'M' })
            .then((url) => (qr = url))
            .catch(() => (qr = ''));
    });

    const fileText = () => chainCodeFileText({ words, recoveryCodes });
    const fileName = $derived(words.length ? 'sync-chain-code.txt' : 'sync-chain-recovery-codes.txt');

    const download = () => downloadTextFile(fileName, fileText());

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(fileText());
            notify('Copied. Paste it somewhere safe, like a password manager.');
        } catch {
            notify('Couldn’t copy; download the codes instead', { tone: 'error' });
        }
    };

    // The print stylesheet (app.scss) hides everything but this section.
    const print = () => window.print();
</script>

<section class="chain-code-step" aria-labelledby="chain-code-title">
    <h3 id="chain-code-title" class="mb-1 font-semibold">
        {words.length ? 'Save your sync chain code' : 'Save your recovery codes'}
    </h3>
    <p class="text-sm text-base-content/65">{intros[code.reason] ?? intros.created}</p>

    {#if words.length}
        <p class="mt-2 text-sm font-medium">
            Anyone with these words can see and change your playlists. Keep them somewhere safe and private, like a
            password manager. They won’t be shown again.
        </p>

        <ol
            class="words mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-box bg-base-200 p-3 font-mono text-sm sm:grid-cols-4"
        >
            {#each words as word, i (i)}
                <li><span class="text-base-content/50">{i + 1}.</span> {word}</li>
            {/each}
        </ol>
    {/if}

    {#if recoveryCodes.length}
        <h4 class="mt-4 text-sm font-semibold">Recovery codes</h4>
        <p class="text-sm text-base-content/65">
            If every device is gone and the code is lost, any one of these gets the chain back. Each works once. Keep
            them apart from the code, for example printed at home.
        </p>
        <ul
            class="codes mt-2 grid grid-cols-1 gap-x-3 gap-y-1 rounded-box bg-base-200 p-3 font-mono text-sm sm:grid-cols-2"
        >
            {#each recoveryCodes as recoveryCode (recoveryCode)}
                <li>{recoveryCode}</li>
            {/each}
        </ul>
    {/if}

    <div class="mt-3 flex flex-wrap items-center gap-4">
        {#if qr}
            <img class="qr rounded-box bg-white p-1" src={qr} alt="The code as a QR code" width="132" height="132" />
        {/if}
        <div class="no-print flex flex-wrap gap-2" class:flex-col={qr}>
            <button class="btn btn-sm" type="button" onclick={download}>
                <Icon name="download" size={16} /> Download as .txt
            </button>
            <button class="btn btn-sm" type="button" onclick={copy}>Copy</button>
            <button class="btn btn-sm" type="button" onclick={print}>Print</button>
        </div>
    </div>

    {#if words.length}
        <fieldset class="no-print fieldset mt-4">
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
    {:else}
        <label class="no-print label mt-4 cursor-pointer gap-3 text-sm text-base-content">
            <input type="checkbox" class="checkbox checkbox-sm" bind:checked={codesSaved} />
            I’ve saved the recovery codes
        </label>
    {/if}

    <div class="no-print mt-4 flex justify-end">
        <button class="btn btn-primary" type="button" disabled={!confirmed} onclick={() => ondone?.()}>
            {words.length ? 'I’ve saved the code' : 'Done'}
        </button>
    </div>
</section>

<style lang="scss">
    // A number and its word, or a whole recovery code, always stay on one line.
    .words li,
    .codes li {
        white-space: nowrap;
    }

    .qr {
        flex: none;
    }
</style>
