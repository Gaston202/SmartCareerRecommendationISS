import { createClient } from '@/lib/supabase/server'
import { transformUser } from '@/lib/supabase/transformers'
import type { User } from '@/types/user'

export const authService = {
  /**
   * Authenticate user with email and password
   * @param email User email
   * @param password Plain text password
   * @returns User object without password if authentication succeeds
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    try {
      const supabase = await createClient()
      
      // Get user by email (including password for verification)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('status', 'active')
        .single()

      if (error || !data) {
        return null
      }

      // Verify password using Supabase function
      const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
        stored_hash: data.password,
        password: password
      })

      if (verifyError) {
        // Check if the function doesn't exist
        if (verifyError?.message?.includes('function') || verifyError?.code === '42883') {
          console.error('Password verification function not found. Please run SUPABASE_ADD_PASSWORD.sql in your Supabase SQL Editor.')
          // If password is not hashed (plain text), compare directly (DEVELOPMENT ONLY)
          // If password is hashed, this won't work
          if (data.password && data.password.startsWith('$2')) {
            // Password is hashed but function doesn't exist - can't verify
            console.error('Password is hashed but verification function is missing')
            return null
          }
          // Plain text password (development only)
          if (data.password !== password) {
            return null
          }
        } else {
          return null
        }
      } else if (!isValid) {
        // Function exists but password doesn't match
        return null
      }

      // Return user without password
      return transformUser(data, false)
    } catch (error) {
      console.error('Authentication error:', error)
      return null
    }
  },

  /**
   * Get user by email
   * @param email User email
   * @returns User object without password
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !data) {
        return null
      }

      return transformUser(data, false) // Never return password
    } catch (error) {
      console.error('Error fetching user:', error)
      return null
    }
  },

  /**
   * Update user password
   * @param userId User ID
   * @param newPassword New plain text password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    try {
      const supabase = await createClient()
      
      // Hash the new password
      const { data: hashedPassword, error: hashError } = await supabase.rpc('hash_password', {
        password: newPassword
      })

      if (hashError) {
        throw new Error('Failed to hash password')
      }

      // Update password
      const { error } = await supabase
        .from('users')
        .update({ password: hashedPassword, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error updating password:', error)
      throw error
    }
  },
}

