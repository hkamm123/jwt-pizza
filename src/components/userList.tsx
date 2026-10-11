import React from 'react';
import { pizzaService } from '../service/service';
import { UserList as UserListData } from '../service/pizzaService';

export default function UserList() {
  const [userList, setUserList] = React.useState<UserListData>({
    users: [],
    more: false,
  });

  React.useEffect(() => {
    (async () => {
      setUserList(await pizzaService.listUsers(0, 10, '*'));
    })();
  }, []);

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
              {['Name', 'Email', 'Role'].map((header) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
