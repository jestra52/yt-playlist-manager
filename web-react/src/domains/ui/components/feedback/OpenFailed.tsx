export const OpenFailed = ({ reason }: { reason: string }) => (
    <main className="font-sans grid min-h-screen place-content-center p-8">
        <div role="alert" className="alert alert-error alert-soft max-w-lg flex-col items-start">
            <h1 className="font-display m-0 text-xl font-bold">The local database didn't open</h1>
            <p className="m-0">{reason}</p>
            <p className="m-0">
                Private browsing or blocked site storage can cause this. Allow storage for this site and reload.
            </p>
        </div>
    </main>
);
