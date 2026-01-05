// /lib/auth.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/authOptions"; // Ton fichier où tu exportes les options NextAuth

export const getAuthSession = async (  
	req?: NextApiRequest,
	res?: NextApiResponse  
	) => 
{
	const session = req && res  
		    ? await getServerSession(req, res, authOptions)  // pages/api/
		    : await getServerSession(authOptions)            // app router
 		
 	if (session?.user?.email) {
		return session
	}     
}

export { authOptions }
