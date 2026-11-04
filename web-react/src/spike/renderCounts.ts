export const renderCounts = new Map<string, number>();

export const countRender = (name: string): void => {
    renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
};

export const resetRenderCounts = (): void => renderCounts.clear();
