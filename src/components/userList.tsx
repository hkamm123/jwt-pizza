import React from 'react';
import { pizzaService } from '../service/service';
import { User, UserList as UserListData } from '../service/pizzaService';
import { TrashIcon } from '../icons';

export default function UserList() {
  const [userList, setUserList] = React.useState<UserListData>({
    users: [],
    more: false,
  });
  const [page, setPage] = React.useState(0);
  const [nameFilter, setNameFilter] = React.useState('*');
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

  async function deleteUser(user: User) {
    await pizzaService.deleteUser(user);
    setUserList(await pizzaService.listUsers(page, 10, nameFilter));
  }

  return (
    <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
      <h3 id="user-list-title" className="text-neutral-100 text-xl">
        Users
      </h3>
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
                  <button
                    type="button"
                    className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                    onClick={() => deleteUser(user)}
                  >
                    <TrashIcon />
                    Delete
                  </button>
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
    </div>
  );
}
