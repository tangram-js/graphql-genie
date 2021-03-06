import { ApolloClient } from 'apollo-client';
import gql from 'graphql-tag';
import { getClient } from '../setupTests';
let client: ApolloClient<any>;
beforeAll(() => {
	client = getClient();
});
beforeEach(() => {
	client.cache['data'].data = {};
});
const testData = {
	users: [],
	posts: [],
	addresses: [],
	comments: []
};
const createUser = gql`
mutation createUser($input: CreateUserMutationInput!) {
	createUser(input: $input) {
		data {
			id
			name
			age
			birthday
			email
		}
		clientMutationId
	}
}
`;
describe('mutationTests', () => {

	test('create - user with posts', async () => {
		const user = await client.mutate({
			mutation: gql`
			mutation {
				createUser(
					input: {
						data: {
							age: 42
							email: "zeus@example.com"
							name: "Zeus"
							writtenSubmissions: {
								posts: {
									create: [{
										title: "Hello World"
										text: "This is my first blog post ever!"
									}, {
										title: "My Second Post"
										text: "My first post was good, but this one is better!"
									}, {
										title: "Solving World Hunger"
										text: "This is a draft..."
									}]
								}
							}
						}
						clientMutationId: "Test"
					}
				) {
					data {
						id
						age
						name
						email
						writtenSubmissions {
							id
							title
						}
					}
					clientMutationId
				}
			}
			`
		});
		testData.users.push(user.data.createUser.data);
		testData.posts = testData.posts.concat(user.data.createUser.data.writtenSubmissions);
		expect(user.data.createUser.clientMutationId).toBe('Test');
		expect(user.data.createUser.data.name).toBe('Zeus');
		expect(user.data.createUser.data.age).toBe(42);
		expect(user.data.createUser.data.email).toBe('zeus@example.com');
		expect(user.data.createUser.data.writtenSubmissions).toHaveLength(3);
		expect(user.data.createUser.data.writtenSubmissions[0].title).toBe('Hello World');
		expect(user.data.createUser.data.writtenSubmissions[1].title).toBe('My Second Post');
		expect(user.data.createUser.data.writtenSubmissions[2].title).toBe('Solving World Hunger');

	});

	test('create - create post connect author', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				createPost(
					input: {
						data: {
							title: "Genie is great"
							text: "Look how fast I can create an executable schema"
							tags: ["genie", "graphql", "database"]
							author: {
								connect:{
									email: "zeus@example.com"
								}
							}
						}
					}
				) {
					data {
						id
						title
						text
						tags
						author {
							email
						}
					}
				}
			}
			`
		});
		testData.posts.push(post.data.createPost.data);
		expect(post.data.createPost.data.title).toBe('Genie is great');
		expect(post.data.createPost.data.text).toBe('Look how fast I can create an executable schema');
		expect(post.data.createPost.data.tags).toEqual(['genie', 'graphql', 'database']);
		expect(post.data.createPost.data.author.email).toBe('zeus@example.com');

	});

	test('update - push onto tags', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				updatePost(
					input: {
						data: {
							tags: {
								push: ["fortune"]
							}
						}
						where: {
							id: "${testData.posts[3].id}"
						}
					}
				) {
					data {
						id
						tags
					}
				}
			}
			`
		});
		expect(post.data.updatePost.data.tags).toEqual(['genie', 'graphql', 'database', 'fortune']);

	});

	test('update - push duplicate onto tags', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				updatePost(
					input: {
						data: {
							tags: {
								push: ["fortune"]
							}
						}
						where: {
							id: "${testData.posts[3].id}"
						}
					}
				) {
					data {
						id
						tags
						created
						updated
					}
				}
			}
			`
		});
		expect(post.data.updatePost.data.created).not.toBeFalsy();
		expect(post.data.updatePost.data.updated).not.toBeFalsy();
		testData.posts[3].updated = new Date(post.data.updatePost.data.updated);
		expect(post.data.updatePost.data.tags).toEqual(['genie', 'graphql', 'database', 'fortune', 'fortune']);
	});

	test('update - push test conditions passing', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				updatePost(
					input: {
						data: {
							tags: {
								push: ["apollo"]
							}
						}
						where: {
							id: "${testData.posts[3].id}"
						},
						conditions: {
							range: {created: ["2018-01-01T01:00:00.000Z", null]}
						}
					}
				) {
					data {
						id
						tags
						created
						updated
					}
				}
			}
			`
		});
		expect(post.data.updatePost.data.created).not.toBeFalsy();
		const updated = new Date(post.data.updatePost.data.updated);
		expect(updated > testData.posts[3].updated).toBe(true);
		testData.posts[3].updated = updated;
		expect(post.data.updatePost.data.tags).toEqual(['genie', 'graphql', 'database', 'fortune', 'fortune', 'apollo']);
	});

	test('update - push test conditions not passing', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				updatePost(
					input: {
						data: {
							tags: {
								push: ["old"]
							}
						}
						where: {
							id: "${testData.posts[3].id}"
						},
						conditions: {
							range: {created: [null, "2018-01-01T01:00:00.000Z"]}
						}
					}
				) {
					data {
						id
						tags
						created
						updated
					}
					unalteredData {
						id
						tags
						created
						updated
					}
				}
			}
			`
		});
		expect(post.data.updatePost.data).toBe(null);
		expect(testData.posts[3].updated).toEqual(new Date(post.data.updatePost.unalteredData.updated));
		expect(post.data.updatePost.unalteredData.tags).not.toContain('old');
		expect(post.data.updatePost.unalteredData.tags).toEqual(['genie', 'graphql', 'database', 'fortune', 'fortune', 'apollo']);

	});

	test('update - pull from tags', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				updatePost(
					input: {
						data: {
							tags: {
								pull: ["fortune"]
							}
						}
						where: {
							id: "${testData.posts[3].id}"
						}
					}
				) {
					data {
						id
						tags
						updated
					}
				}
			}
			`
		});

		expect(post.data.updatePost.data.tags).toEqual(['genie', 'graphql', 'database', 'apollo']);
		const updated = new Date(post.data.updatePost.data.updated);
		expect(updated > testData.posts[3].updated).toBe(true);
		testData.posts[3].updated = updated;

	});

	test('update - set tags', async () => {
		const post = await client.mutate({
			mutation: gql`mutation {
				updatePost(
					input: {
						data: {
							tags: {
								set: ["fortune"]
							}
						}
						where: {
							id: "${testData.posts[3].id}"
						}
					}
				) {
					data {
						id
						tags
					}
				}
			}
			`
		});
		expect(post.data.updatePost.data.tags).toEqual(['fortune']);

	});

	test('update - create address on user and update age', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							age: 5000
							address: {
								create: {
									city: "Olympus"
								}
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						address {
							city
							user {
								name
							}
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.name).toBe('Zeus');
		expect(user.data.updateUser.data.age).toBe(5000);
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.address.city).toBe('Olympus');
		expect(user.data.updateUser.data.address.user.name).toBe('Zeus');

	});

	test('update - disconnect address on user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							address: {
								disconnect: true
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						address {
							city
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.name).toBe('Zeus');
		expect(user.data.updateUser.data.age).toBe(5000);
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.address).toBeNull();

	});

	test('update - update posts on user with age', async () => {
		const secondPostId = testData.posts[1].id;
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							age: 5001
							writtenSubmissions: {
								posts: {
									update: [
										{
											data: {
												title: "My Updated Post"
												tags: {
													set: ["updated"]
												}
											}
											where: {
												id: "${secondPostId}"
											}
										}
									]
								}
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						writtenSubmissions {
							title
							tags
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.name).toBe('Zeus');
		expect(user.data.updateUser.data.age).toBe(5001);
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.writtenSubmissions[1].title).toBe('My Updated Post');
		expect(user.data.updateUser.data.writtenSubmissions[1].tags).toEqual(['updated']);

	});

	test('upsert - create new user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				upsertUser(
					input: {
						create: {
							name: "Corey"
							email: "corey@example.com"
						}
						update: {
							age: 30
						}
						where: {
							email: "corey@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
					}
				}
			}
			`
		});
		testData.users.push(user.data.upsertUser.data);
		expect(user.data.upsertUser.data.name).toBe('Corey');
		expect(user.data.upsertUser.data.age).toBeNull();
		expect(user.data.upsertUser.data.email).toBe('corey@example.com');

	});

	test('upsert - update upserted user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				upsertUser(
					input: {
						create: {
							name: "Corey"
							email: "corey@example.com"
						}
						update: {
							age: 30
						}
						where: {
							email: "corey@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
					}
				}
			}
			`
		});
		expect(user.data.upsertUser.data.name).toBe('Corey');
		expect(user.data.upsertUser.data.age).toBe(30);
		expect(user.data.upsertUser.data.email).toBe('corey@example.com');
	});

	test('upsert - nested upsert create family member on user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							family: {
								upsert: [
									{
										update: {
											age: 4950
										}
										create: {
											name: "Loki"
											email: "loki@example.com"
										}
										where:{
											email: "loki@example.com"
										}
									}
								]
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						family {
							name
							email
							age
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.family[0].name).toBe('Loki');
		expect(user.data.updateUser.data.family[0].email).toBe('loki@example.com');
		expect(user.data.updateUser.data.family[0].age).toBeNull();

	});

	test('upsert - nested upsert update family member on user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							family: {
								upsert: [
									{
										update: {
											age: 4950
										}
										create: {
											name: "Loki"
											email: "loki@example.com"
										}
										where:{
											email: "loki@example.com"
										}
									}
								]
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						family {
							name
							email
							age
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.family[0].name).toBe('Loki');
		expect(user.data.updateUser.data.family[0].email).toBe('loki@example.com');
		expect(user.data.updateUser.data.family[0].age).toBe(4950);
	});

	test('upsert - nested upsert create address member on user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							address: {
								upsert: {
									create: {
										city: "New York"
									}
									update: {
										city: "Olympus"
									}
								}
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						address {
							id
							city
						}
					}
				}
			}
			`
		});
		testData.addresses.push(user.data.updateUser.data.address);
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.address.city).toBe('New York');
	});

	test('upsert - nested upsert update address member on user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							address: {
								upsert: {
									create: {
										city: "New York"
									}
									update: {
										city: "Olympus"
									}
								}
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						address {
							id
							city
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.address.city).toBe('Olympus');
	});

	test('update - nested update update address member on user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							address: {
								update: {
									city: "Eau Claire"
								}
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						address {
							id
							city
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.address.city).toBe('Eau Claire');
	});

	test('delete - delete user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				deleteUser(input: {
					where: {
						email: "corey@example.com"
					}
				}) {
					data {
						id
						name
						email
					}
				}
			}
			`
		});
		expect(user.data.deleteUser.data.email).toBe('corey@example.com');
	});

	test('update - delete address from user', async () => {
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							address: {
								delete: true
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						age
						address {
							id
							city
						}
					}
				}
			}
			`
		});
		expect(user.data.updateUser.data.address).toBeNull();
	});

	test('find - make sure address is deleted', async () => {
		const addresses = gql`
			query addresses($where: JSON) {
				addresses(where: $where) {
					id
				}
			}
			`;
		const result = await client.query({
			query: addresses,
			variables: { where: { match: { id: testData.addresses[0].id } } }
		});

		expect(result.data['addresses']).toHaveLength(0);
	});

	test('update - delete post on user', async () => {
		const secondPostId = testData.posts[1].id;
		const user = await client.mutate({
			mutation: gql`mutation {
				updateUser(
					input: {
						data: {
							writtenSubmissions: {
								posts: {
									delete: [{    id: "${secondPostId}"}]
								}
							}
						}
						where: {
							email: "zeus@example.com"
						}
					}
				) {
					data {
						id
						name
						email
						age
						writtenSubmissions {
							title
						}
					}
				}
			}
			`
		});

		expect(user.data.updateUser.data.email).toBe('zeus@example.com');
		expect(user.data.updateUser.data.writtenSubmissions).toHaveLength(3);

	});

	test('find - make sure post is deleted', async () => {
		const posts = gql`
			query posts($where: JSON) {
				posts(where: $where) {
					id
				}
			}
			`;
		const result = await client.query({
			query: posts,
			variables: { where: { match: { id: testData.posts[1].id } } }
		});
		expect(result.data['posts']).toHaveLength(0);
	});

	test('update - update many users', async () => {

		const zain = await client.mutate({
			mutation: createUser,
			variables: { input: { data: { name: 'Zain', birthday: '1996-01-22', email: 'zain@example.com' } } }
		});
		const steve = await client.mutate({
			mutation: createUser,
			variables: { input: { data: { name: 'Steve', birthday: '1992-06-02', email: 'steve@example.com' } } }
		});

		const pete = await client.mutate({
			mutation: createUser,
			variables: { input: { data: { name: 'Pete', birthday: '1988-06-02', email: 'pete@example.com' } } }
		});

		testData.users.push(zain.data.createUser.data);
		testData.users.push(steve.data.createUser.data);
		testData.users.push(pete.data.createUser.data);

		const updateManyUsers = gql`
				mutation {
					updateManyUsers(input: {
						where: {
							exists: {
								age: false
							}
						}
						data: {
							age: 12
						}
					}) {
						count
					}
				}
			`;
		const result = await client.mutate({
			mutation: updateManyUsers
		});

		const findPete = gql`
			{
				users(email: "pete@example.com") {
					age
				}
			}
		`;

		const peteResult = await client.query({
			query: findPete
		});
		expect(result.data['updateManyUsers'].count).toBe(3);
		expect(peteResult.data['users']).toHaveLength(1);
		expect(peteResult.data['users'][0].age).toBe(12);
	});

test('update - update many users, try to set unique field', async () => {

		const updateManyUsers = gql`
				mutation {
					updateManyUsers(input: {
						where: {
							exists: {
								age: true
							}
						}
						data: {
							email: "this update should fail"
						}
					}) {
						count
					}
				}
			`;

		expect.assertions(2);
		try {
			await client.mutate({
				mutation: updateManyUsers
			});
		} catch (e) {
			expect(e).not.toBeNull();
			expect(e['message']).toContain('multiple');
		}

	});

	test('create - unique field check', async () => {

		const createPost = gql`
				mutation {
					createPost(
						input: {
							data: {
								title: "should not create"
								author: {
									create: {
										name: "zeus"
										email: "zeus@example.com"
									}
								}
							}
							clientMutationId: "Test"
						}
					) {
						data {
							id
							title
						}
						clientMutationId
					}
				}
			`;
		expect.assertions(2);
		try {
			await client.mutate({
				mutation: createPost
			});
		} catch (e) {
			expect(e).not.toBeNull();
			expect(e['message']).toContain('duplicate');
		}

	});

	test('deleteMany - users age 12', async () => {

		const deleteManyUsers = gql`
				mutation {
					deleteManyUsers(input: {
						where: {
							match: {
								age: 12
							}
						}
					}) {
						count
					}
				}
			`;
		const result = await client.mutate({
			mutation: deleteManyUsers
		});

		const findPete = gql`
		{
			users(email: "pete@example.com") {
				age
			}
		}
	`;

		const peteResult = await client.query({
			query: findPete
		});

		expect(result.data['deleteManyUsers'].count).toBe(3);
		expect(peteResult.data['users'][0]).toBeNull();

	});

	test('createUser - with creating union types', async () => {

		const createUser = gql`
			mutation {
				createUser(input: {data: {name: "joe", email: "joe@example.com",
					starred: {
						users: {
							create: {
								name: "jim",
								email: "jim@example.com"
							}
						}
						comments: {
							create: {
								title: "bam"
							}
						}
					}
				}}) {
					data {
						name
						starred {
							...on User {
								name
								email
							}
							...on Submission {
								title
							}
						}
					}
				}
			}

			`;
		const result = await client.mutate({
			mutation: createUser
		});

		expect(result.data['createUser'].data.name).toBe('joe');
		expect(result.data['createUser'].data.starred[0].name).toBe('jim');
		expect(result.data['createUser'].data.starred[1].title).toBe('bam');

	});
});
