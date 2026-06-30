import toast from 'react-hot-toast';

export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  loading: (message: string) => toast.loading(message),
  info: (message: string) => toast(message, { icon: 'ℹ️' }),
  promise: <T,>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) => toast.promise(promise, msgs),
};
