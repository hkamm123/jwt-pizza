import React from 'react';
import { pizzaService } from '../service/service';
import { User, UserList as UserListData } from '../service/pizzaService';
import { CloseIcon, TrashIcon } from '../icons';
import { HSOverlay } from 'preline';

interface Props {
  user: User | null;
}

export default function UserList(props: Props) {
  const [userList, setUserList] = React.useState<UserListData>({
    users: [],
    more: false,
  });
  const [page, setPage] = React.useState(0);
  const [nameFilter, setNameFilter] = React.useState('*');
  const [errMessage, setErrorMessage] = React.useState('');
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const filterUserRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    (async () => {
      setUserList(await pizzaService.listUsers(page, 10, nameFilter));
    })();
  }, [page, nameFilter]);

  function filterUsers() {
    setPage(0);
    setNameFilter(`*${filterUserRef.current?.value}*`);
  }

  function confirmDelete(user: User) {
    setUserToDelete(user);
    HSOverlay.open(document.getElementById('hs-delete-user-modal')!);
  }

  // The delay lets preline finish opening the dialog before we close it,
  // which matters when automation clicks right after it appears.
  function closeDeleteDialog() {
    setTimeout(() => {
      HSOverlay.close(document.getElementById('hs-delete-user-modal')!);
    }, 100);
  }

  async function deleteUser(user: User) {
    try {
      await pizzaService.deleteUser(user);
    } catch (err: any) {
      setErrorMessage(err.message);
      return;
    }
    setErrorMessage('');
    const updatedList = await pizzaService.listUsers(page, 10, nameFilter);
    if (updatedList.users.length === 0 && page > 0) {
      // Changing the page makes the effect above load the previous page
      setPage(page - 1);
    } else {
      setUserList(updatedList);
    }
  }

  return (
    <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
      <h3 id="user-list-title" className="text-neutral-100 text-xl">
        Users
      </h3>
      {errMessage && (
        <div role="alert" className="text-orange-700 bg-yellow-100 p-2 rounded-md">
          ⚠️ {errMessage}
        </div>
      )}
      <div className="bg-neutral-100 overflow-clip my-4">
        <table
          aria-labelledby="user-list-title"
          className="min-w-full divide-y divide-gray-200"
        >
          <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
            <tr>
              {['Name', 'Email', 'Role', 'Action'].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {userList.users.map((user) => (
              <tr key={user.id} className="bg-neutral-100">
                <td className="text-start px-2 whitespace-nowrap text-sm text-gray-800">
                  {user.name}
                </td>
                <td className="text-start px-2 whitespace-nowrap text-sm text-gray-800">
                  {user.email}
                </td>
                <td className="text-start px-2 whitespace-nowrap text-sm text-gray-800">
                  {user.roles?.map((r) => r.role).join(', ')}
                </td>
                <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                  {user.id !== props.user?.id && (
                    <button
                      type="button"
                      className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                      onClick={() => confirmDelete(user)}
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-1 py-1">
                <input
                  type="text"
                  ref={filterUserRef}
                  name="filterUser"
                  placeholder="Filter users"
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                  onClick={filterUsers}
                >
                  Apply Filter
                </button>
              </td>
              <td colSpan={3} className="text-end text-sm font-medium">
                <button
                  className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 0}
                >
                  «
                </button>
                <span className="mx-2 text-gray-800">Page {page + 1}</span>
                <button
                  className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                  onClick={() => setPage(page + 1)}
                  disabled={!userList.more}
                >
                  »
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        id="hs-delete-user-modal"
        className="hs-overlay hidden size-full fixed top-10 start-0 z-[80] overflow-x-hidden overflow-y-auto pointer-events-none"
      >
        <div className="hs-overlay-open:mt-7 hs-overlay-open:opacity-100 hs-overlay-open:duration-500 mt-0 opacity-0 ease-out transition-all sm:max-w-lg sm:w-full m-3 sm:mx-auto">
          <div className="w-full flex flex-col bg-white border shadow-sm rounded-xl pointer-events-auto">
            <div className="flex justify-between items-center py-3 px-4 border-b bg-slate-200 rounded-t-xl">
              <h3 id="delete-user-title" className="font-bold text-gray-800">
                Delete user
              </h3>
              <button
                type="button"
                className="flex justify-center items-center size-7 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100"
                data-hs-overlay="#hs-delete-user-modal"
              >
                <CloseIcon className="" />
              </button>
            </div>
            <div className="p-4 text-gray-800">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{userToDelete?.name}</span> ({userToDelete?.email})? This cannot be undone.
            </div>
            <div className="flex justify-end items-center gap-x-2 py-3 px-4 border-t bg-slate-200 rounded-b-xl">
              <button
                type="button"
                className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50"
                onClick={closeDeleteDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-orange-400 bg-orange-400 text-white shadow-sm hover:bg-orange-600"
                onClick={() => {
                  closeDeleteDialog();
                  deleteUser(userToDelete!);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
