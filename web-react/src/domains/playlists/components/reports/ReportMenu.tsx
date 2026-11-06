import { useRef } from 'react';
import { useAppDispatch } from '../../../../app/store';
import { Icon } from '../../../../shared/components/Icon';
import { downloadReport } from '../../playlists.thunks';

export const ReportMenu = ({ playlistId }: { playlistId: string }) => {
    const menuRef = useRef<HTMLDetailsElement>(null);
    const dispatch = useAppDispatch();

    const download = (format: 'json' | 'txt') => {
        if (menuRef.current) menuRef.current.open = false;
        dispatch(downloadReport(playlistId, format));
    };

    return (
        <details ref={menuRef} className="dropdown dropdown-end">
            <summary
                className="btn btn-ghost btn-sm"
                role="button"
                title="Download a list of the videos"
                aria-label="Download a report of this playlist's videos"
            >
                <Icon name="download" size={16} />
                <span className="max-md:hidden">Report</span>
            </summary>
            <ul className="menu dropdown-content rounded-box bg-base-100 z-10 m-0 w-56 p-2 shadow-lg">
                <li>
                    <button type="button" onClick={() => download('json')}>
                        JSON (can be restored)
                    </button>
                </li>
                <li>
                    <button type="button" onClick={() => download('txt')}>
                        Text (easy to read)
                    </button>
                </li>
            </ul>
        </details>
    );
};
