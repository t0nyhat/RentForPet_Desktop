import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="text-center px-6">
        {/* 404 Number */}
        <h1 className="text-9xl font-bold bg-gradient-to-r from-brand to-brand-dark bg-clip-text text-transparent">
          404
        </h1>

        {/* Message */}
        <h2 className="mt-4 text-3xl font-bold text-gray-900">Page not found</h2>
        <p className="mt-2 text-lg text-gray-600 max-w-md mx-auto">
          Sorry, the requested page does not exist or has been moved.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-brand to-brand-dark hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
          >
            Return to home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
          >
            Back
          </button>
        </div>

        {/* Decorative blob */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand-dark/10 rounded-full blur-3xl -z-10" />
      </div>
    </div>
  );
};

export default NotFound;
