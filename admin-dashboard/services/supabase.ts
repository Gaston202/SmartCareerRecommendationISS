import { createClient } from '@/lib/supabase/server'
import { User, Career, Skill, Course, Recommendation } from '@/types/career'
import {
  transformUser,
  transformCareer,
  transformSkill,
  transformCourse,
  transformRecommendation,
} from '@/lib/supabase/transformers'

// Users Service
export const usersService = {
  async getAll() {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        // Provide more helpful error messages
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          throw new Error('Users table does not exist. Please run the SQL scripts from SUPABASE_SETUP.md')
        }
        if (error.message?.includes('fetch failed')) {
          throw new Error('Failed to connect to Supabase. Please check your internet connection and Supabase URL.')
        }
        throw error
      }
      return (data || []).map(transformUser)
    } catch (error: any) {
      // Re-throw with more context
      if (error.message?.includes('Missing Supabase environment variables')) {
        throw error
      }
      if (error.message?.includes('fetch failed') || error.cause?.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Supabase. Please verify your NEXT_PUBLIC_SUPABASE_URL in .env.local')
      }
      throw error
    }
  },

  async getById(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return transformUser(data)
  },

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password?: string }) {
    const supabase = await createClient()
    
    // If password is provided, hash it using Supabase function
    let hashedPassword = null;
    if (userData.password) {
      const { data: hashData, error: hashError } = await supabase.rpc('hash_password', {
        password: userData.password
      });
      if (hashError) {
        // Fallback: hash on server side if function doesn't exist
        // In production, you should use a proper hashing library
        console.warn('Password hashing function not available, password will be stored as-is (NOT RECOMMENDED)');
        hashedPassword = userData.password; // WARNING: This is insecure!
      } else {
        hashedPassword = hashData;
      }
    }
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        status: userData.status || 'active',
        avatar: userData.avatar,
        phone: userData.phone,
        password: hashedPassword,
      })
      .select()
      .single()

    if (error) throw error
    return transformUser(data) // Never return password
  },

  async update(id: string, updates: Partial<User>) {
    const supabase = await createClient()
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {}
    if (updates.email !== undefined) dbUpdates.email = updates.email
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.role !== undefined) dbUpdates.role = updates.role
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone
    dbUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return transformUser(data)
  },

  async delete(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('users').delete().eq('id', id)

    if (error) throw error
  },
}

// Careers Service
export const careersService = {
  async getAll() {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('careers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(transformCareer)
  },

  async getById(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('careers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return transformCareer(data)
  },

  async create(careerData: Omit<Career, 'id' | 'createdAt' | 'updatedAt'>) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('careers')
      .insert({
        title: careerData.title,
        description: careerData.description,
        category: careerData.category,
        required_skills: careerData.requiredSkills,
        average_salary: careerData.averageSalary,
        growth_rate: careerData.growthRate,
        demand_level: careerData.demandLevel,
      })
      .select()
      .single()

    if (error) throw error
    return transformCareer(data)
  },

  async update(id: string, updates: Partial<Career>) {
    const supabase = await createClient()
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.category !== undefined) dbUpdates.category = updates.category
    if (updates.requiredSkills !== undefined) dbUpdates.required_skills = updates.requiredSkills
    if (updates.averageSalary !== undefined) dbUpdates.average_salary = updates.averageSalary
    if (updates.growthRate !== undefined) dbUpdates.growth_rate = updates.growthRate
    if (updates.demandLevel !== undefined) dbUpdates.demand_level = updates.demandLevel
    dbUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('careers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return transformCareer(data)
  },

  async delete(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('careers').delete().eq('id', id)

    if (error) throw error
  },
}

// Skills Service
export const skillsService = {
  async getAll() {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(transformSkill)
  },

  async getById(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return transformSkill(data)
  },

  async create(skillData: Omit<Skill, 'id' | 'createdAt'>) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('skills')
      .insert({
        name: skillData.name,
        category: skillData.category,
        description: skillData.description,
        related_careers: skillData.relatedCareers,
      })
      .select()
      .single()

    if (error) throw error
    return transformSkill(data)
  },

  async update(id: string, updates: Partial<Skill>) {
    const supabase = await createClient()
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.category !== undefined) dbUpdates.category = updates.category
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.relatedCareers !== undefined) dbUpdates.related_careers = updates.relatedCareers

    const { error } = await supabase
      .from('skills')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('skills').delete().eq('id', id)

    if (error) throw error
  },
}

// Courses Service
export const coursesService = {
  async getAll() {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(transformCourse)
  },

  async getById(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return transformCourse(data)
  },

  async create(courseData: Omit<Course, 'id'>) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('courses')
      .insert({
        title: courseData.title,
        provider: courseData.provider,
        description: courseData.description,
        skills_targeted: courseData.skillsTargeted,
        duration: courseData.duration,
        level: courseData.level,
        url: courseData.url,
        price: courseData.price,
        rating: courseData.rating,
      })
      .select()
      .single()

    if (error) throw error
    return transformCourse(data)
  },

  async update(id: string, updates: Partial<Course>) {
    const supabase = await createClient()
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.provider !== undefined) dbUpdates.provider = updates.provider
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.skillsTargeted !== undefined) dbUpdates.skills_targeted = updates.skillsTargeted
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration
    if (updates.level !== undefined) dbUpdates.level = updates.level
    if (updates.url !== undefined) dbUpdates.url = updates.url
    if (updates.price !== undefined) dbUpdates.price = updates.price
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating

    const { error } = await supabase.from('courses').update(dbUpdates).eq('id', id)

    if (error) throw error
  },

  async delete(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('courses').delete().eq('id', id)

    if (error) throw error
  },
}

// Recommendations Service
export const recommendationsService = {
  async getAll() {
    const supabase = await createClient()
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select('*')
      .order('generated_at', { ascending: false })

    if (error) throw error

    // Fetch related careers and courses for each recommendation
    const enrichedRecommendations = await Promise.all(
      (recommendations || []).map(async (rec) => {
        const careerIds = rec.career_ids || []
        const courseIds = rec.course_ids || []

        // Fetch careers
        const { data: careers } = careerIds.length > 0
          ? await supabase.from('careers').select('*').in('id', careerIds)
          : { data: [] }

        // Fetch courses
        const { data: courses } = courseIds.length > 0
          ? await supabase.from('courses').select('*').in('id', courseIds)
          : { data: [] }

        return {
          ...rec,
          careers: careers || [],
          courses: courses || [],
        }
      })
    )

    return enrichedRecommendations.map(transformRecommendation)
  },

  async getByUserId(userId: string) {
    const supabase = await createClient()
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })

    if (error) throw error

    // Fetch related careers and courses for each recommendation
    const enrichedRecommendations = await Promise.all(
      (recommendations || []).map(async (rec) => {
        const careerIds = rec.career_ids || []
        const courseIds = rec.course_ids || []

        // Fetch careers
        const { data: careers } = careerIds.length > 0
          ? await supabase.from('careers').select('*').in('id', careerIds)
          : { data: [] }

        // Fetch courses
        const { data: courses } = courseIds.length > 0
          ? await supabase.from('courses').select('*').in('id', courseIds)
          : { data: [] }

        return {
          ...rec,
          careers: careers || [],
          courses: courses || [],
        }
      })
    )

    return enrichedRecommendations.map(transformRecommendation)
  },

  async create(recommendationData: Omit<Recommendation, 'id' | 'generatedAt'>) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('recommendations')
      .insert({
        user_id: recommendationData.userId,
        career_ids: recommendationData.careers.map((c) => c.id),
        course_ids: recommendationData.courses.map((c) => c.id),
        match_score: recommendationData.matchScore,
        status: recommendationData.status,
      })
      .select()
      .single()

    if (error) throw error
    return transformRecommendation(data)
  },

  async update(id: string, updates: Partial<Recommendation>) {
    const supabase = await createClient()
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {}
    if (updates.userId !== undefined) dbUpdates.user_id = updates.userId
    if (updates.matchScore !== undefined) dbUpdates.match_score = updates.matchScore
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.careers !== undefined) dbUpdates.career_ids = updates.careers.map((c) => c.id)
    if (updates.courses !== undefined) dbUpdates.course_ids = updates.courses.map((c) => c.id)

    const { error } = await supabase
      .from('recommendations')
      .update(dbUpdates)
      .eq('id', id)

    if (error) throw error
  },
}

// Dashboard Stats Service
export const dashboardService = {
  async getStats() {
    const supabase = await createClient()

    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Get active users (status = 'active')
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get total recommendations
    const { count: totalRecommendations } = await supabase
      .from('recommendations')
      .select('*', { count: 'exact', head: true })

    // Get recommendations by status
    const { data: recommendationsByStatus } = await supabase
      .from('recommendations')
      .select('status')

    const statusCounts = recommendationsByStatus?.reduce(
      (acc, rec) => {
        acc[rec.status] = (acc[rec.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Calculate conversion rate (viewed / total)
    const viewedCount = statusCounts?.viewed || 0
    const conversionRate =
      totalRecommendations && totalRecommendations > 0
        ? (viewedCount / totalRecommendations) * 100
        : 0

    // Get user growth data (users created by month) - cumulative
    const { data: allUsers } = await supabase
      .from('users')
      .select('created_at')
      .order('created_at', { ascending: true })

    // Group users by month and calculate cumulative count
    const monthlyCounts: Record<string, number> = {}
    allUsers?.forEach((user: any) => {
      const date = new Date(user.created_at)
      const month = date.toLocaleString('default', { month: 'short' })
      monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
    })

    // Convert to cumulative array
    let cumulative = 0
    const userGrowth = Object.entries(monthlyCounts)
      .map(([month, count]) => {
        cumulative += count
        return { month, users: cumulative }
      })
      .sort((a, b) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return months.indexOf(a.month) - months.indexOf(b.month)
      })

    // Get career recommendations by category
    const { data: allCareers } = await supabase
      .from('careers')
      .select('category')

    const careerCounts = allCareers?.reduce(
      (acc, career) => {
        acc[career.category] = (acc[career.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const careerRecommendationsByCategory = Object.entries(careerCounts || {}).map(([category, count]) => ({
      category,
      count,
    }))

    // Get total careers
    const { count: totalCareers } = await supabase
      .from('careers')
      .select('*', { count: 'exact', head: true })

    // Get total courses
    const { count: totalCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })

    // Get total skills
    const { count: totalSkills } = await supabase
      .from('skills')
      .select('*', { count: 'exact', head: true })

    return {
      totalUsers: totalUsers || 0,
      activeSessions: activeUsers || 0,
      activeUsers: activeUsers || 0,
      totalRecommendations: totalRecommendations || 0,
      totalCareers: totalCareers || 0,
      totalCourses: totalCourses || 0,
      totalSkills: totalSkills || 0,
      conversionRate: Math.round(conversionRate * 10) / 10,
      recommendationStatus: Object.entries(statusCounts || {}).map(([status, count]) => ({
        status,
        count,
      })),
      userGrowth,
      careerRecommendationsByCategory,
    }
  },
}

