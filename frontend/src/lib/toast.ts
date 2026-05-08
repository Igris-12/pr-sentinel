import toast from 'react-hot-toast';

export const openAlertBox = (status: string, msg: string) => {
  if (status === 'Success' || status === 'success') {
    toast.success(msg);
  } else {
    toast.error(msg);
  }
};
