export function LoadingState() {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2
  border-emerald-600" />
      </div>
    );
  }

  export function ErrorState({ message, onRetry }: { message: string; onRetry?:
  () => void }) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]
  text-center">
        <p className="text-red-600 mb-4">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="px-4 py-2 bg-emerald-600
  text-white rounded-lg">
            Reessayer
          </button>
        )}
      </div>
    );
  }
