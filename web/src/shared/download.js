/** Saves text as a UTF-8 file through the browser's download flow. */
export const downloadTextFile = (fileName, text) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
