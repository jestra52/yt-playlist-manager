import { act, fireEvent, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { ContextSidebar } from './context/ContextSidebar';
import { ContextVideoList } from './context/ContextVideoList';
import { VideosProvider } from './context/VideosContext';
import { makeVideos } from './fixture';
import { ReduxSidebar } from './redux/ReduxSidebar';
import { ReduxVideoList } from './redux/ReduxVideoList';
import { createVideosStore } from './redux/videosStore';
import { renderCounts, resetRenderCounts } from './renderCounts';

const COUNT = 1000;
const TOGGLES = 100;

interface Result {
    mountMs: number;
    oneToggle: Record<string, number>;
    togglesMs: number;
    commitMs: number;
}

const measure = (ui: React.ReactNode): Result => {
    let commitMs = 0;
    const onRender = (_id: string, _phase: string, actual: number) => {
        commitMs += actual;
    };
    const mountStart = performance.now();
    render(
        <Profiler id="spike" onRender={onRender}>
            {ui}
        </Profiler>,
    );
    const mountMs = performance.now() - mountStart;

    resetRenderCounts();
    fireEvent.click(screen.getByLabelText('Watched Video 1'));
    const oneToggle = Object.fromEntries(renderCounts);

    commitMs = 0;
    const start = performance.now();
    for (let i = 0; i < TOGGLES; i++) {
        act(() => {
            fireEvent.click(screen.getByLabelText(`Watched Video ${(i % 9) + 1}`));
        });
    }
    return { mountMs, oneToggle, togglesMs: performance.now() - start, commitMs };
};

const report = (name: string, r: Result) => {
    console.warn(
        `[spike] ${name}: mount ${r.mountMs.toFixed(0)} ms; one toggle re-renders ${JSON.stringify(r.oneToggle)}; ` +
            `${TOGGLES} toggles ${r.togglesMs.toFixed(0)} ms (React commit ${r.commitMs.toFixed(0)} ms)`,
    );
};

describe(`state spike: ${COUNT} videos`, () => {
    it('Redux Toolkit re-renders only the changed row and the sidebar', () => {
        const store = createVideosStore(makeVideos(COUNT));
        const r = measure(
            <Provider store={store}>
                <ReduxSidebar />
                <ReduxVideoList playlistId="p1" />
            </Provider>,
        );
        report('Redux Toolkit', r);
        expect(r.oneToggle).toEqual({ row: 1, sidebar: 1 });
    });

    it('Context re-renders the list and the sidebar, and the changed row', () => {
        const r = measure(
            <VideosProvider videos={makeVideos(COUNT)}>
                <ContextSidebar />
                <ContextVideoList playlistId="p1" />
            </VideosProvider>,
        );
        report('Context + useReducer', r);
        expect(r.oneToggle).toEqual({ row: 1, sidebar: 1, list: 1 });
    });
});
