import { useAppSelector } from '../../../../app/store';
import { selectKnownArtists } from '../../videos.selectors';

export const KnownArtists = () => {
    const artists = useAppSelector(selectKnownArtists);
    return (
        <datalist id="known-artists">
            {artists.map((artist) => (
                <option key={artist} value={artist} />
            ))}
        </datalist>
    );
};
