interface LoadingSkeletonProps {
  lines?: number;
  type?: 'card' | 'table' | 'chart';
}

export default function LoadingSkeleton({ lines = 3, type = 'card' }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className="bg-white rounded-xl shadow overflow-x-auto animate-pulse">
        <div className="bg-gray-50 p-4">
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, row) => (
            <div key={row} className="p-4">
              <div className="grid grid-cols-6 gap-4">
                {[...Array(6)].map((_, col) => (
                  <div key={col} className="h-4 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="bg-white rounded-xl shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
      {[...Array(lines)].map((_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded mb-3" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow p-6 animate-pulse">
      <div className="w-12 h-12 bg-gray-200 rounded-lg mb-3" />
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-8 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto animate-pulse">
      <div className="bg-gray-50 p-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {[...Array(cols)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {[...Array(rows)].map((_, row) => (
          <div key={row} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {[...Array(cols)].map((_, col) => (
                <div key={col} className="h-4 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
