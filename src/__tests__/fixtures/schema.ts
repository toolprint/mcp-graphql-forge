import { buildSchema } from 'graphql';

export const testSchema = buildSchema(`
  scalar Date
  
  enum UserRole {
    ADMIN
    USER
    MODERATOR
  }
  
  input CreateUserInput {
    name: String!
    email: String!
    role: UserRole = USER
    age: Int
  }
  
  input UpdateUserInput {
    name: String
    email: String
    role: UserRole
    age: Int
  }
  
  input UserFilters {
    role: UserRole
    minAge: Int
    maxAge: Int
    searchTerm: String
  }
  
  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
    age: Int
    createdAt: Date!
    posts: [Post!]!
  }
  
  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    publishedAt: Date
    tags: [String!]!
  }
  
  type Query {
    # Get a single user by ID
    user(id: ID!): User
    
    # Get multiple users with optional filtering
    users(filters: UserFilters, limit: Int = 10, offset: Int = 0): [User!]!
    
    # Get user count
    userCount(filters: UserFilters): Int!
    
    # Get a single post
    post(id: ID!): Post
    
    # Search posts
    posts(authorId: ID, searchTerm: String, limit: Int = 20): [Post!]!
  }
  
  type Mutation {
    # Create a new user
    createUser(input: CreateUserInput!): User!
    
    # Update an existing user
    updateUser(id: ID!, input: UpdateUserInput!): User!
    
    # Delete a user
    deleteUser(id: ID!): Boolean!
    
    # Create a post
    createPost(
      title: String!
      content: String!
      authorId: ID!
      tags: [String!] = []
    ): Post!
    
    # Publish a post
    publishPost(id: ID!): Post!
    
    # Delete a post
    deletePost(id: ID!): Boolean!
  }
  
  type Subscription {
    # Subscribe to user events
    userCreated: User!
    
    # Subscribe to post events
    postPublished: Post!
  }
`);