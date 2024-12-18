import e, { Request, Response } from 'express';

import { checkIfIamAdmin } from './utility_controller.js';
import { assignPackageGroupQuery, checkGroupExistsQuery, doesGroupExistQuery, getAllGroupsQuery, getAllGroupsWithNameQuery, getUsersByGroupQuery, insertToGroupsQuery, insertUserToGroupQuery, isUserAlreadyInGroupQuery, updateUserGroupQuery } from '../queries/groups_queries.js';
import { doesUserExistQuery } from '../queries/users_queries.js';
import { checkPackageExistsQuery } from '../queries/packages_queries.js';
import {log} from '../phase_1/logging.js'


// creating group can only be accessed by admin 
export const createGroup=async(req:Request,res:Response)=>{

    const {name}=req.body;


    
    if(!name){
      res.status(401).json({error:"missing name"})
      return
    }


    // checking if the user is admin
    const isAdmin=await checkIfIamAdmin(req)
    if(isAdmin==-1){
      res.status(402).json("token is missing or expired")
      return 
    }

    if(isAdmin==0){
      res.status(403).json({error:"you are not admin"})
      return
    }

    // fetch the group to check if it already exists before 
    const results=await getAllGroupsWithNameQuery(name)
  
    if(results.rows.length>0){
      res.status(400).json({error:"this group  already exists"})
      log(`group with name ${name} already exists`)
      return 
    }
  
    try{

      // inserting the group to the database
      const group=await insertToGroupsQuery(name)
      log(`we inserted group ${name} with id ${group.rows[0].id}`)
      res.status(202).json({id:group.rows[0].id})  
    }catch(err){
      res.status(500).json({error:"internal server error"})
      log(`internal server error`)
    }
    
}
  
  

// assign user to group, every user can be obly assigned to 0 or 1 group and can only be assigned by the admin 
export const assignUserToGroup=async(req:Request,res:Response)=>{
  
    const groupId=parseInt(req.params.groupid,10)
    const {user_id}=req.body
    log(`we are adding ${user_id} to group ${groupId}`)


    if (!groupId || !user_id) {
       res.status(400).json({ error: "Missing group ID or user ID" });
       return
    }
  
    try {
      const isAdmin=await checkIfIamAdmin(req)

      if (isAdmin==-1) {
        res.status(401).json({ error: 'Unauthorized: Token missing or expired' });
        return
      }

      if (isAdmin!=1) {
          res.status(403).json({ error: 'Only admins can assign users to group.' });
          log(`you are not an admin`)
          return
      }


      // Check if the group exists
      const groupExists = await doesGroupExistQuery(groupId);
      if (!groupExists) {
        
         res.status(404).json({ error: "Group does not exist" });
         log(`group with id ${groupId} doesn't exists`)
         return
      }
  
      // Check if the user exists
      const userExists = await doesUserExistQuery(user_id);
      if (!userExists) {
        res.status(404).json({ error: "User does not exist" });
        return 
      }
  
      
      const isUserInGroup = await isUserAlreadyInGroupQuery(user_id);
      if (isUserInGroup) {
  
         await updateUserGroupQuery(user_id,groupId)
         res.status(202).json({ message: `User assigned to a new group ${groupId}`});
         log(`User ${user_id} assigned to a new group ${groupId}`)
         return
      }
      
      await insertUserToGroupQuery(user_id, groupId);
  
      res.status(201).json({ message: "User added to the group successfully" });
      log(`user ${user_id} is added successfully to ${groupId}`)

    } catch (error) {

      log(`Error adding user to group:${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
};
  


// view all groups, can only accessed by admins 
export const getAllGroups = async (req: Request, res: Response) => {

    log("Getting all groups available...");
  
    const amIAdmin = await checkIfIamAdmin(req);

    if (amIAdmin === -1) {

      res.status(401).json({ error: "Token missing or invalid or expired" });
      log("Token missing or invalid");
      return;
    }
    

    // checking if I am the admin
    if (!amIAdmin) {

      res.status(403).json({ error: "Forbidden: Only admins can view all groups" });
      log("User is not an admin");
      return;
    }
  
    try {

      const results = await getAllGroupsQuery();
      res.status(200).json(results.rows); // Return only the rows

    } catch (error) {

      log(`Error fetching all groups:${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
};
  
  


// get users assigned to a specific group 
export const getUsersByGroup=async(req:Request,res:Response)=>{
  
    log("we are getting user by groups ")
    const groupId=parseInt(req.params.groupid ,10)
  
    if (!groupId){
  
      res.status(402).json({"error":"group id missing"})
      log(`group id missing`)
      return 
  
    }
  
    try{
  
    const amIAdmin = await checkIfIamAdmin(req);
    if (amIAdmin === -1) {
      res.status(401).json({ error: "Token missing or invalid or expired" });
      log("Token missing or invalid");
      return;
    }
  
    if (!amIAdmin) {
      res.status(403).json({ error: "Forbidden: Only admins can view users by groups" });
      log("User is not an admin");
      return;
    }
  
  
    const results=await getUsersByGroupQuery(groupId)
    res.status(202).json(results.rows)
    log(`we got  users by Groups successfully`)
    return 
    }catch(err){
  
      res.status(500).json({"error":`internal server error ${err}`})
      log(`error happened while getting users by groups: ${err}`)
  
    }
  
}
  
  


// assign a specific package to group only users with the same group as the package can interact with the package
export const assignPackageToGroup=async(req:Request,res:Response)=>{
  

    let groupIdRead=req.params.groupid 
    let {package_id}=req.body


    if(!groupIdRead ||!package_id){
      res.status(405).json({error:"missing group id or package id "})
      return
    }


    package_id=Number(package_id)
    const groupId=Number(groupIdRead)

    if(isNaN(package_id) || isNaN(groupId)){

      res.status(406).json({error:"wrong format for group id or package id "})
      return
    }



    try{

      const isAdmin=await checkIfIamAdmin(req)
      
      
      if (isAdmin==-1) {
        res.status(401).json({ error: 'Unauthorized: Token missing or expired' });
        return
      }

      
      if (isAdmin!=1 ) {
          res.status(403).json({ error: 'Only admins can assign packages to group.' });
          log(`you are not an admin`)
          return
      }

      //checking if the group and the package already exists
      const checkGroupExistsFlag=await checkGroupExistsQuery(groupId)
      const checkPackageExistsFlag=await checkPackageExistsQuery(package_id)
      if(!checkGroupExistsFlag.rows.length||!checkPackageExistsFlag.rows.length){

          res.status(400).json({"error":"either group or package doesn't exists"})
          log(`either group ${groupId} or package ${package_id} doesn't exists`)
          return 

      }


      // assigning the package to the group
      await assignPackageGroupQuery(package_id,groupId)
      res.status(200).json({ message: "Package successfully assigned to group" });
      log(`Package ${package_id} successfully assigned to ${groupId}`)
      return 


    }catch(err){

      log(`Error assigning package to group:${err}`, );
      res.status(500).json({ error: "Internal server error" });
      return 
  
    } 



}
  