import { Resources, Services } from "@tago-io/sdk";
import { TagoContext, TagsObj } from "@tago-io/sdk/lib/types";

import { fetchUserList } from "./fetch-user-list";

/** Account Summary
 * @param  {Object} context analysis context
 * @param  {Object} user user object with their data
 * Example: { name: 'John Doe', phone: '+1444562367', email: 'johndoe@tago.io', timezone: 'America/Chicago' }
 * @param  {Array} tags tags to be added/update in to the user
 * Example: [{ key: 'country', value: 'United States' }]
 * @return {Promise}
 */

interface UserData {
  email: string;
  name: string;
  phone?: string | number | boolean | void;
  timezone: string;
  tags?: TagsObj[];
  password?: string;
}

async function updateUserAndReturnID(user_data: UserData) {
  // If got an error, try to find the user_data.
  const [user] = await fetchUserList({ email: user_data.email });
  if (!user) {
    throw "Couldn`t find user data";
  }

  // If found, update the tags.
  user.tags = user.tags?.filter((x) => user_data.tags?.find((y) => x.key !== y.key));
  user.tags = user.tags?.concat(user_data.tags || []);

  await Resources.run.userEdit(user.id, { tags: user_data.tags });

  return user.id;
}

/**
 * Function that register new user
 * @param  {Class} resources This is a class with resources should be used with account token because the Access Management doesn't have permission
 * @param  {Object} context Context is a variable sent by the analysis
 * @param  {Object} user_data User data
 * @param  {String} domain_url Domain URL
 */
async function inviteUser(resources: Resources, context: TagoContext, user_data: UserData, domain_url: string) {
  user_data.email = user_data.email.toLowerCase();

  // Generate a Random Password
  const password = user_data.password || `A${Math.random().toString(36).slice(2, 12)}!`;
  // the parameter "resources" should be used with account token because the Access Management doesn't have permission
  const { timezone } = await resources.account.info();

  let createError = "";
  // Try to create the user.
  const result = await Resources.run
    .userCreate({
      active: true,
      company: "",
      email: user_data.email,
      language: "en",
      name: user_data.name,
      phone: String(user_data.phone || ""),
      tags: user_data.tags,
      timezone: user_data.timezone || timezone || "America/New_York",
      password,
    })
    .catch((error) => {
      createError = error;
      return null;
    });

  if (!result) {
    return updateUserAndReturnID(user_data).catch(() => {
      throw createError;
    });
  }

  // If success, send an email with the password
  const emailService = new Services({ token: context.token }).email;
  void emailService
    .send({
      to: user_data.email,
      subject: "Account Details",
      message: `Your account for the application was created! \n\nYour Login is: ${user_data.email}\nYour password is: ${password}\n\n In order to access it, visit our website \n${domain_url}`,
    })
    .catch((error) => console.log(error));

  return result.user;
}

export { inviteUser };
